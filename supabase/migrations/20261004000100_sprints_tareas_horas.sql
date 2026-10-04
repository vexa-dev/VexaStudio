-- C19: sprints, tareas, etiquetas de tarea, horas (con reloj unico), borradores y ausencias.
--
-- Reglas tomadas del mock (apps/web/src/services/mock/work.ts):
--   * Solo admin crea proyectos/sprints/tareas y asigna responsables.
--   * Socios y colaboradores mueven solo sus tareas asignadas (solo `status` y `link`).
--   * Ver tareas: admin todas; los demas las propias y las de proyectos de los que son miembros.
--   * Cada persona crea y edita solo sus horas; edicion hasta `entry_edit_days` o hasta que
--     el registro este aprobado; nadie borra (se anula con motivo).
--   * Revisan otros socios/admin, sin autoaprobacion.
--   * Un solo temporizador abierto por usuario (indice unico parcial).
-- Las invariantes viven en triggers de guarda (valen sin importar por que ruta se escriba);
-- las transiciones atomicas se exponen como funciones RPC SECURITY INVOKER.

create type public.sprint_status as enum ('planned', 'active', 'closed');
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
-- Instante en ISO 8601 UTC con milisegundos (formato de los segmentos del dominio).
create function private.iso(p_ts timestamptz) returns text
language sql immutable parallel safe set search_path = ''
as $$ select to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- Fecha de negocio en Lima (UTC-5, sin horario de verano).
create function private.lima_date(p_ts timestamptz) returns date
language sql immutable parallel safe set search_path = ''
as $$ select (p_ts at time zone 'America/Lima')::date $$;

-- ---------------------------------------------------------------------------
-- sprints
-- ---------------------------------------------------------------------------
create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  start_date date not null,
  end_date date not null,
  goal text not null check (btrim(goal) <> ''),
  status public.sprint_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id),
  check (end_date >= start_date)
);
-- Un solo sprint activo por proyecto.
create unique index sprints_one_active_uidx on public.sprints (project_id)
  where status = 'active';
create trigger sprints_updated_at before update on public.sprints
  for each row execute function private.set_updated_at();

-- Como el mock: el primer sprint del proyecto nace activo; los siguientes, planificados.
create function private.sprints_before_insert() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.goal := btrim(new.goal);
  new.status := case
    when exists (
      select 1 from public.sprints s where s.project_id = new.project_id and s.status = 'active'
    ) then 'planned'::public.sprint_status
    else 'active'::public.sprint_status
  end;
  return new;
end;
$$;
create trigger sprints_before_insert before insert on public.sprints
  for each row execute function private.sprints_before_insert();

-- ---------------------------------------------------------------------------
-- tasks y task_labels
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid,
  project_id uuid references public.projects (id),
  title text not null check (btrim(title) <> ''),
  description text check (char_length(description) <= 20000),
  status public.task_status not null default 'todo',
  assignee_id uuid references public.profiles (id),
  estimate_hours numeric check (estimate_hours is null or estimate_hours >= 0),
  link text check (link is null or link ~* '^https?://[^\s]+$'),
  -- Interna: ya se preparo el borrador de horas al finalizar la tarea.
  hours_prepared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- El sprint debe pertenecer al proyecto de la tarea.
  foreign key (sprint_id, project_id) references public.sprints (id, project_id),
  check (sprint_id is null or project_id is not null)
);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_project_idx on public.tasks (project_id, status);
create index tasks_sprint_idx on public.tasks (sprint_id);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

create table public.task_labels (
  task_id uuid not null references public.tasks (id),
  label_id uuid not null references public.project_labels (id),
  primary key (task_id, label_id)
);
create index task_labels_label_idx on public.task_labels (label_id);

-- Una etiqueta solo se adjunta a tareas de su propio proyecto.
create function private.task_labels_check() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tasks t join public.project_labels l on l.project_id = t.project_id
    where t.id = new.task_id and l.id = new.label_id
  ) then
    raise exception 'Las etiquetas deben pertenecer al proyecto de la tarea'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger task_labels_check before insert on public.task_labels
  for each row execute function private.task_labels_check();

-- ---------------------------------------------------------------------------
-- hours_drafts, time_entries, absences
-- ---------------------------------------------------------------------------
create table public.hours_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  task_id uuid references public.tasks (id),
  project_id uuid references public.projects (id),
  title text not null,
  hours numeric not null default 0 check (hours >= 0),
  -- true cuando las horas vienen del reloj; false si son la estimacion de la tarea.
  measured boolean not null default false,
  draft_date date not null,
  entry_ids uuid[] not null default '{}',
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index hours_drafts_pending_idx on public.hours_drafts (user_id)
  where submitted_at is null;

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  task_id uuid references public.tasks (id),
  project_id uuid references public.projects (id),
  description text,
  evidence_url text check (evidence_url is null or evidence_url ~* '^https?://[^\s]+$'),
  source text check (source is null or source in ('manual', 'timer')),
  started_at timestamptz not null,
  -- NULL mientras el temporizador esta abierto.
  ended_at timestamptz,
  hours numeric not null default 0 check (hours >= 0),
  paid boolean not null default false,
  validated boolean not null default false,
  validated_at timestamptz,
  validated_by uuid references public.profiles (id),
  review_note text,
  reviewed_by uuid references public.profiles (id),
  -- Sesion de reloj cerrada que espera confirmacion en un borrador (no cuenta en historial).
  draft boolean not null default false,
  timer_state text check (timer_state is null or timer_state in ('running', 'paused')),
  elapsed_ms bigint not null default 0 check (elapsed_ms >= 0),
  segment_started_at timestamptz,
  -- [{start, end}] en ISO UTC, como TimeEntry.segments.
  segments jsonb check (segments is null or jsonb_typeof(segments) = 'array'),
  -- [{taskId, title, projectId, hours}] de un registro confirmado desde borradores.
  allocations jsonb check (allocations is null or jsonb_typeof(allocations) = 'array'),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  -- Temporizador abierto <=> tiene estado; en marcha <=> tiene inicio de segmento.
  check ((ended_at is null) = (timer_state is not null)),
  check (timer_state is distinct from 'running' or segment_started_at is not null),
  check (ended_at is null or ended_at >= started_at),
  check (not draft or ended_at is not null),
  check ((voided_at is null) = (void_reason is null)),
  check (not validated or (validated_at is not null and validated_by is not null))
);
-- Una sola entrada abierta (en marcha o en pausa) por usuario.
create unique index time_entries_one_open_timer_uidx on public.time_entries (user_id)
  where ended_at is null and voided_at is null;
create index time_entries_user_started_idx on public.time_entries (user_id, started_at);
create index time_entries_task_idx on public.time_entries (task_id);

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  from_date date not null,
  to_date date not null,
  reason text not null default '',
  -- Horas que reduce del minimo del periodo (mes de `from_date`).
  reduced_hours numeric not null default 0 check (reduced_hours >= 0),
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index absences_user_idx on public.absences (user_id, from_date);

-- ---------------------------------------------------------------------------
-- Funciones de permisos
-- ---------------------------------------------------------------------------
-- Admin ve todas las tareas; los demas, las propias y las de sus proyectos.
create function public.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.auth_role() is not null and exists (
    select 1 from public.tasks t
    where t.id = p_task and (
      public.is_admin()
      or t.assignee_id = (select auth.uid())
      or (t.project_id is not null and public.is_project_member(t.project_id))
    )
  )
$$;

-- Equivalente a rules.canEditEntry: ni pagado ni anulado; con aclaracion pendiente siempre
-- se puede; si no, hasta `entry_edit_days` desde la creacion.
create function private.can_edit_entry(
  p_created timestamptz, p_voided timestamptz, p_paid boolean, p_review_note text
) returns boolean
language sql stable set search_path = ''
as $$
  select case
    when p_paid or p_voided is not null then false
    when p_review_note is not null and p_review_note <> '' then true
    else clock_timestamp() - p_created
         <= make_interval(days => (select s.entry_edit_days from public.settings s))
  end
$$;

-- ---------------------------------------------------------------------------
-- Guarda de tareas
-- ---------------------------------------------------------------------------
-- Cierra una sesion de reloj abierta: fija el fin, calcula las horas y la suma a su
-- borrador (como `closeEntry` del mock). SECURITY DEFINER porque tambien la usa la
-- preparacion de horas al finalizar una tarea ajena; solo se llama desde codigo de
-- confianza (el esquema `private` no esta expuesto por la API).
create function private.close_timer_entry(p_id uuid, p_now timestamptz)
returns public.time_entries
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('vexa.internal', true), '');
  e public.time_entries;
  d public.hours_drafts;
  v_now timestamptz := date_trunc('milliseconds', p_now);
  v_segments jsonb;
  v_ms bigint;
begin
  select * into e from public.time_entries
  where id = p_id and ended_at is null for update;
  if not found then
    return null;
  end if;
  if v_prev <> 'on' and (select auth.uid()) is not null
     and e.user_id <> (select auth.uid()) then
    raise exception 'Solo puedes cerrar tu propio reloj' using errcode = '42501';
  end if;
  perform set_config('vexa.internal', 'on', true);

  v_segments := coalesce(e.segments, '[]'::jsonb);
  if e.timer_state is distinct from 'paused' then
    v_segments := v_segments || jsonb_build_array(jsonb_build_object(
      'start', private.iso(coalesce(e.segment_started_at, e.started_at)),
      'end', private.iso(v_now)
    ));
  end if;
  select coalesce(sum(greatest(0, round(extract(epoch from
      (s ->> 'end')::timestamptz - (s ->> 'start')::timestamptz) * 1000))), 0)::bigint
  into v_ms from jsonb_array_elements(v_segments) s;

  update public.time_entries set
    segments = v_segments,
    ended_at = greatest(v_now, e.started_at),
    elapsed_ms = v_ms,
    hours = v_ms / 3600000.0,
    segment_started_at = null,
    timer_state = null,
    draft = true
  where id = e.id
  returning * into e;

  select * into d from public.hours_drafts
  where user_id = e.user_id and task_id is not distinct from e.task_id and submitted_at is null
  order by created_at, id limit 1 for update;
  if not found then
    insert into public.hours_drafts (user_id, task_id, project_id, title, hours, measured, draft_date)
    values (e.user_id, e.task_id, e.project_id, coalesce(e.description, 'Trabajo realizado'),
            0, true, private.lima_date(v_now))
    returning * into d;
  end if;
  update public.hours_drafts set
    hours = case when d.measured then d.hours else 0 end + e.hours,
    measured = true,
    entry_ids = d.entry_ids || e.id
  where id = d.id;

  perform set_config('vexa.internal', v_prev, true);
  return e;
end;
$$;

-- Al finalizar una tarea con responsable: cierra su reloj abierto y deja un borrador de horas
-- (la estimacion es solo una sugerencia). Se hace una sola vez por tarea.
create function private.prepare_task_hours(
  p_task uuid, p_assignee uuid, p_project uuid, p_title text, p_estimate numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('vexa.internal', true), '');
  v_open uuid;
begin
  -- El responsable puede ser otra persona (admin finaliza su tarea): codigo de confianza.
  perform set_config('vexa.internal', 'on', true);
  for v_open in
    select id from public.time_entries
    where user_id = p_assignee and task_id = p_task and ended_at is null and voided_at is null
  loop
    perform private.close_timer_entry(v_open, clock_timestamp());
  end loop;
  if not exists (
    select 1 from public.hours_drafts d
    where d.task_id = p_task and d.submitted_at is null
  ) then
    insert into public.hours_drafts (user_id, task_id, project_id, title, hours, measured, draft_date)
    values (p_assignee, p_task, p_project, p_title, coalesce(p_estimate, 0), false,
            private.lima_date(clock_timestamp()));
  end if;
  perform set_config('vexa.internal', v_prev, true);
end;
$$;

create function private.tasks_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hidden text[] := array['link', 'status', 'hours_prepared', 'updated_at'];
begin
  new.title := btrim(new.title);
  if new.title = '' then
    raise exception 'Escribe el titulo de la tarea' using errcode = '23514';
  end if;
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (select 1 from public.profiles p where p.id = new.assignee_id and p.active) then
    raise exception 'El responsable no existe' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.hours_prepared := false;
    return new;
  end if;

  new.hours_prepared := old.hours_prepared;
  -- Quien no es admin solo trabaja en sus tareas y solo cambia `status` y `link`.
  if v_uid is not null and public.auth_role() is distinct from 'admin' then
    if old.assignee_id is distinct from v_uid then
      raise exception 'Solo puedes trabajar en tus tareas asignadas' using errcode = '42501';
    end if;
    if (to_jsonb(new) - v_hidden) is distinct from (to_jsonb(old) - v_hidden) then
      raise exception 'Solo el administrador edita la asignacion y el contenido'
        using errcode = '42501';
    end if;
  end if;

  -- Al cambiar de proyecto se retiran las etiquetas del proyecto anterior.
  if new.project_id is distinct from old.project_id then
    delete from public.task_labels tl
    using public.project_labels l
    where tl.task_id = new.id and l.id = tl.label_id
      and l.project_id is distinct from new.project_id;
  end if;

  if new.status = 'done' and not new.hours_prepared and new.assignee_id is not null then
    new.hours_prepared := true;
    perform private.prepare_task_hours(
      new.id, new.assignee_id, new.project_id, new.title, new.estimate_hours
    );
  end if;
  return new;
end;
$$;
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function private.tasks_guard();

-- ---------------------------------------------------------------------------
-- Guarda de horas: integridad independiente de la ruta de escritura
-- ---------------------------------------------------------------------------
-- Con `vexa.internal = on` (funciones de confianza) o sin usuario (mantenimiento con rol
-- de servicio / consola) no se aplican las reglas de usuario.
create function private.time_entries_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_changed text[];
  v_review text[] := array['validated', 'validated_at', 'validated_by', 'review_note', 'reviewed_by'];
  v_content boolean;
begin
  if v_uid is null or coalesce(current_setting('vexa.internal', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id <> v_uid then
      raise exception 'Solo puedes registrar tus propias horas' using errcode = '42501';
    end if;
    if new.validated or new.paid or new.draft or new.voided_at is not null
       or new.validated_at is not null or new.validated_by is not null
       or new.review_note is not null or new.reviewed_by is not null then
      raise exception 'Un registro nuevo no puede nacer revisado, pagado o anulado'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'El registro no cambia de dueno ni de fecha de creacion' using errcode = '42501';
  end if;
  select coalesce(array_agg(k), '{}') into v_changed
  from jsonb_object_keys(to_jsonb(new)) k
  where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;
  if cardinality(v_changed) = 0 then
    return new;
  end if;
  if new.paid is distinct from old.paid then
    raise exception 'El pago no se registra desde aqui' using errcode = '42501';
  end if;
  if old.paid or old.voided_at is not null then
    raise exception 'Este registro esta pagado o anulado y no se puede modificar'
      using errcode = '42501';
  end if;

  if v_uid = old.user_id then
    -- Dueno: no toca la revision salvo el reinicio automatico al editar.
    if new.voided_at is distinct from old.voided_at then
      if old.validated then
        raise exception 'No se puede anular un registro validado' using errcode = '42501';
      end if;
      if char_length(btrim(coalesce(new.void_reason, ''))) < 3 then
        raise exception 'Escribe el motivo de la anulacion' using errcode = '23514';
      end if;
      if exists (select 1 from unnest(v_changed) k where k <> all (array['voided_at', 'void_reason'])) then
        raise exception 'Al anular no se modifica nada mas' using errcode = '42501';
      end if;
      new.voided_at := clock_timestamp();
      new.void_reason := btrim(new.void_reason);
      return new;
    end if;

    v_content := old.ended_at is not null and (
      (new.task_id, new.project_id, new.description, new.evidence_url, new.started_at,
       new.ended_at, new.hours, new.source)
        is distinct from
      (old.task_id, old.project_id, old.description, old.evidence_url, old.started_at,
       old.ended_at, old.hours, old.source)
      or new.segments is distinct from old.segments
      or new.allocations is distinct from old.allocations
    );
    if v_content then
      if not private.can_edit_entry(old.created_at, old.voided_at, old.paid, old.review_note) then
        raise exception
          'Este registro ya no se puede editar: pasaron los dias permitidos o esta pagado/anulado'
          using errcode = '42501';
      end if;
      -- Corregir una aprobacion la devuelve a pendiente y retira sus puntos.
      new.validated := false;
      new.validated_at := null;
      new.validated_by := null;
      new.review_note := null;
      new.reviewed_by := null;
    elsif (new.validated, new.validated_at, new.validated_by, new.review_note, new.reviewed_by)
          is distinct from
          (old.validated, old.validated_at, old.validated_by, old.review_note, old.reviewed_by) then
      raise exception 'No puedes modificar la revision de tus propias horas' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Revisor (otro socio o admin): solo columnas de revision, sobre registros finalizados.
  if old.draft or old.ended_at is null or old.hours <= 0 then
    raise exception 'Este registro no esta disponible para revision' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(v_changed) k where k <> all (v_review)) then
    raise exception 'Solo puedes aprobar o pedir aclaracion' using errcode = '42501';
  end if;
  if new.validated and not old.validated then
    -- Aprobacion: sellos del servidor; limpia la aclaracion.
    new.validated_at := clock_timestamp();
    new.validated_by := v_uid;
    new.reviewed_by := v_uid;
    new.review_note := null;
  elsif not new.validated and not old.validated
        and new.review_note is not null and new.review_note is distinct from old.review_note then
    if char_length(btrim(new.review_note)) < 8 then
      raise exception 'Explica que necesita aclaracion' using errcode = '23514';
    end if;
    new.review_note := btrim(new.review_note);
    new.reviewed_by := v_uid;
    new.validated_at := null;
    new.validated_by := null;
  else
    raise exception 'Operacion de revision no valida' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger time_entries_guard before insert or update on public.time_entries
  for each row execute function private.time_entries_guard();

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke all on public.sprints, public.tasks, public.task_labels, public.hours_drafts,
  public.time_entries, public.absences from public, anon, authenticated;
grant select, insert, update on public.sprints to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert, delete on public.task_labels to authenticated;
grant select, insert, update on public.hours_drafts to authenticated;
grant select, insert, update on public.time_entries to authenticated;
grant select, insert, update on public.absences to authenticated;

revoke execute on function public.can_view_task(uuid) from public, anon;
grant execute on function public.can_view_task(uuid) to authenticated;
-- (El barrido final de privilegios de `private` queda en C23.)
revoke execute on all functions in schema private from public, anon;
grant execute on function private.iso(timestamptz), private.lima_date(timestamptz),
  private.can_edit_entry(timestamptz, timestamptz, boolean, text),
  private.close_timer_entry(uuid, timestamptz),
  private.prepare_task_hours(uuid, uuid, uuid, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.sprints enable row level security;
alter table public.tasks enable row level security;
alter table public.task_labels enable row level security;
alter table public.hours_drafts enable row level security;
alter table public.time_entries enable row level security;
alter table public.absences enable row level security;

create policy sprints_select on public.sprints for select to authenticated
  using (public.can_access_project(project_id));
create policy sprints_insert_admin on public.sprints for insert to authenticated
  with check (public.is_admin());
create policy sprints_update_admin on public.sprints for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy tasks_select on public.tasks for select to authenticated
  using (
    public.auth_role() is not null and (
      public.is_admin()
      or assignee_id = (select auth.uid())
      or (project_id is not null and public.is_project_member(project_id))
    )
  );
create policy tasks_insert_admin on public.tasks for insert to authenticated
  with check (public.is_admin());
-- Admin edita todo; el responsable mueve su tarea (la guarda limita a status y link).
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_admin() or (public.auth_role() is not null and assignee_id = (select auth.uid())))
  with check (public.is_admin() or (public.auth_role() is not null and assignee_id = (select auth.uid())));

-- Etiquetas adjuntas: visibles con la tarea; el catalogo completo solo lo ve admin.
create policy task_labels_select on public.task_labels for select to authenticated
  using (public.can_view_task(task_id));
create policy task_labels_insert_admin on public.task_labels for insert to authenticated
  with check (public.is_admin());
create policy task_labels_delete_admin on public.task_labels for delete to authenticated
  using (public.is_admin());
-- Complementa project_labels_select_admin (C18): quien ve la tarea ve sus etiquetas.
create policy project_labels_select_attached on public.project_labels
  for select to authenticated
  using (exists (select 1 from public.task_labels tl where tl.label_id = project_labels.id));

create policy hours_drafts_own_select on public.hours_drafts for select to authenticated
  using (public.auth_role() is not null and user_id = (select auth.uid()));
create policy hours_drafts_own_insert on public.hours_drafts for insert to authenticated
  with check (public.auth_role() is not null and user_id = (select auth.uid()));
create policy hours_drafts_own_update on public.hours_drafts for update to authenticated
  using (public.auth_role() is not null and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Horas: el colaborador solo ve las suyas; socios y admin ven las de todos (revision),
-- salvo las sesiones de reloj en borrador, que son solo del dueno.
create policy time_entries_select on public.time_entries for select to authenticated
  using (
    public.auth_role() is not null and (
      user_id = (select auth.uid())
      or (public.is_partner_or_admin() and not draft)
    )
  );
create policy time_entries_insert_own on public.time_entries for insert to authenticated
  with check (public.auth_role() is not null and user_id = (select auth.uid()));
create policy time_entries_update on public.time_entries for update to authenticated
  using (
    public.auth_role() is not null and (
      user_id = (select auth.uid())
      or (public.is_partner_or_admin() and not draft)
    )
  )
  with check (
    user_id = (select auth.uid()) or (public.is_partner_or_admin() and not draft)
  );

create policy absences_select on public.absences for select to authenticated
  using (
    public.auth_role() is not null
    and (user_id = (select auth.uid()) or public.is_partner_or_admin())
  );
create policy absences_insert_admin on public.absences for insert to authenticated
  with check (public.is_admin());
create policy absences_update_admin on public.absences for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RPC de horas y reloj (SECURITY INVOKER)
-- ---------------------------------------------------------------------------
-- Validaciones compartidas con el mock (assertActivity / assertHours / assertInterval).
create function private.assert_activity(p_project uuid, p_evidence text) returns void
language plpgsql set search_path = ''
as $$
begin
  if p_project is not null and not exists (select 1 from public.projects where id = p_project) then
    raise exception 'El proyecto no existe';
  end if;
  if p_evidence is not null and p_evidence <> '' and p_evidence !~* '^https?://[^\s]+$' then
    raise exception 'Usa un enlace http o https';
  end if;
end;
$$;

create function private.assert_hours(p_hours numeric) returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_hours is null or p_hours <= 0 or p_hours > 24 then
    raise exception 'Las horas deben estar entre 0 y 24';
  end if;
end;
$$;

create function private.assert_interval(
  p_started timestamptz, p_hours numeric, p_user uuid, p_exclude uuid default null
) returns void
language plpgsql set search_path = ''
as $$
declare
  v_end timestamptz := p_started + p_hours * interval '1 hour';
begin
  if v_end > clock_timestamp() then
    raise exception 'El registro no puede terminar en el futuro';
  end if;
  if exists (
    select 1 from public.time_entries e
    where e.id is distinct from p_exclude and e.user_id = p_user
      and e.voided_at is null and not e.draft
      and (e.source is not null or e.ended_at is null)
      and p_started < coalesce(e.ended_at, clock_timestamp())
      and v_end > e.started_at
  ) then
    raise exception 'Este horario se superpone con otro registro';
  end if;
end;
$$;

-- TimeService.start: detiene el reloj abierto (queda como borrador), abre uno nuevo y
-- pasa la tarea a "En progreso".
create function public.start_timer(
  p_task uuid default null,
  p_description text default null,
  p_project uuid default null,
  p_evidence_url text default null
) returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := date_trunc('milliseconds', clock_timestamp());
  v_task public.tasks;
  v_open uuid;
  e public.time_entries;
begin
  if public.auth_role() is null then
    raise exception 'Inicia sesion para continuar';
  end if;
  if p_task is not null then
    select * into v_task from public.tasks where id = p_task;
    if not found then
      raise exception 'La tarea no existe';
    end if;
    if v_task.assignee_id is distinct from v_uid then
      raise exception 'Solo puedes trabajar en tus tareas asignadas';
    end if;
  elsif char_length(btrim(coalesce(p_description, ''))) < 8 then
    raise exception 'Describe el trabajo que vas a realizar';
  end if;
  perform private.assert_activity(p_project, p_evidence_url);

  for v_open in
    select id from public.time_entries
    where user_id = v_uid and ended_at is null and voided_at is null for update
  loop
    perform private.close_timer_entry(v_open, v_now);
  end loop;

  insert into public.time_entries (
    user_id, task_id, project_id, description, evidence_url, source, timer_state,
    segment_started_at, segments, elapsed_ms, started_at, hours
  ) values (
    v_uid, p_task, coalesce(v_task.project_id, p_project),
    coalesce(nullif(btrim(p_description), ''), v_task.title), nullif(p_evidence_url, ''),
    'timer', 'running', v_now, '[]'::jsonb, 0, v_now, 0
  ) returning * into e;

  if v_task.status = 'todo' then
    update public.tasks set status = 'in_progress' where id = v_task.id;
  end if;
  return e;
end;
$$;

-- TimeService.pause
create function public.pause_timer() returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  v_now timestamptz := date_trunc('milliseconds', clock_timestamp());
  e public.time_entries;
  v_segments jsonb;
begin
  select * into e from public.time_entries
  where user_id = (select auth.uid()) and ended_at is null and voided_at is null for update;
  if not found or e.timer_state = 'paused' then
    return e;
  end if;
  v_segments := coalesce(e.segments, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'start', private.iso(coalesce(e.segment_started_at, e.started_at)), 'end', private.iso(v_now)));
  update public.time_entries set
    segments = v_segments,
    elapsed_ms = (select coalesce(sum(round(extract(epoch from
      (s ->> 'end')::timestamptz - (s ->> 'start')::timestamptz) * 1000)), 0)::bigint
      from jsonb_array_elements(v_segments) s),
    segment_started_at = null,
    timer_state = 'paused'
  where id = e.id returning * into e;
  return e;
end;
$$;

-- TimeService.resume
create function public.resume_timer() returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.time_entries;
begin
  select * into e from public.time_entries
  where user_id = (select auth.uid()) and ended_at is null and voided_at is null for update;
  if not found or e.timer_state is distinct from 'paused' then
    return e;
  end if;
  update public.time_entries set
    timer_state = 'running',
    segment_started_at = date_trunc('milliseconds', clock_timestamp())
  where id = e.id returning * into e;
  return e;
end;
$$;

-- TimeService.stop: cierra el reloj y lo deja en un borrador de horas.
create function public.stop_timer() returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  v_open uuid;
begin
  select id into v_open from public.time_entries
  where user_id = (select auth.uid()) and ended_at is null and voided_at is null for update;
  if v_open is null then
    return null;
  end if;
  return private.close_timer_entry(v_open, clock_timestamp());
end;
$$;

-- TimeService.submitDrafts: confirma borradores en UN registro con asignaciones por tarea.
-- p_items: [{"id": "<draft uuid>", "hours": 2.5}, ...]
create function public.submit_hours_drafts(
  p_items jsonb, p_date date, p_description text default null
) returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_ids uuid[];
  v_total numeric := 0;
  v_n integer;
  v_started timestamptz;
  v_ended timestamptz;
  v_allocations jsonb := '[]'::jsonb;
  v_titles text[] := '{}'::text[];
  v_task uuid;
  v_project uuid;
  v_all_measured boolean := true;
  v_same boolean := true;
  v_segments jsonb;
  v_measured_hours numeric;
  v_use_timer boolean := false;
  r record;
  e public.time_entries;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Selecciona tareas distintas';
  end if;
  select array_agg((i ->> 'id')::uuid) into v_ids from jsonb_array_elements(p_items) i;
  if (select count(distinct x) from unnest(v_ids) x) <> cardinality(v_ids) then
    raise exception 'Selecciona tareas distintas';
  end if;
  if p_date is null or p_date > private.lima_date(v_now) then
    raise exception 'Fecha no valida';
  end if;

  v_n := 0;
  for r in
    select d.*, (i ->> 'hours')::numeric as item_hours, o.ord
    from jsonb_array_elements(p_items) with ordinality o(i, ord)
    join public.hours_drafts d on d.id = (o.i ->> 'id')::uuid
      and d.user_id = v_uid and d.submitted_at is null
    order by o.ord
    for update of d
  loop
    v_n := v_n + 1;
    perform private.assert_hours(r.item_hours);
    v_total := v_total + r.item_hours;
    v_titles := v_titles || r.title;
    if r.task_id is not null then
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
        'taskId', r.task_id, 'title', r.title, 'projectId', r.project_id, 'hours', r.item_hours));
    end if;
    if v_n = 1 then
      v_task := r.task_id;
      v_project := r.project_id;
    end if;
    if not (r.measured and abs(r.item_hours - r.hours) < 0.00001) then
      v_all_measured := false;
    end if;
    if r.draft_date <> p_date then
      v_same := false;
    end if;
  end loop;
  if v_n <> cardinality(v_ids) then
    raise exception 'El borrador ya no esta disponible';
  end if;
  perform private.assert_hours(v_total);
  if v_n > 1 then
    v_task := null;
    v_project := null;
  end if;

  v_started := (p_date + time '12:00') at time zone 'America/Lima';
  v_ended := v_started + v_total * interval '1 hour';

  -- Se conservan los intervalos reales solo si coinciden con lo confirmado.
  select coalesce(jsonb_agg(s order by s ->> 'start'), '[]'::jsonb),
         coalesce(sum(extract(epoch from (s ->> 'end')::timestamptz - (s ->> 'start')::timestamptz)
                      / 3600), 0)
  into v_segments, v_measured_hours
  from public.hours_drafts d
  join public.time_entries t on t.id = any (d.entry_ids)
  cross join lateral jsonb_array_elements(coalesce(t.segments, '[]'::jsonb)) s
  where d.id in (select (i ->> 'id')::uuid from jsonb_array_elements(p_items) i);
  if v_all_measured and v_same and jsonb_array_length(v_segments) > 0
     and abs(v_measured_hours - v_total) < 0.00001 then
    v_use_timer := true;
    v_started := (v_segments -> 0 ->> 'start')::timestamptz;
    v_ended := (v_segments -> (jsonb_array_length(v_segments) - 1) ->> 'end')::timestamptz;
  end if;

  insert into public.time_entries (
    user_id, task_id, project_id, description, allocations, hours, started_at, ended_at,
    source, segments
  ) values (
    v_uid, v_task, v_project,
    coalesce(nullif(btrim(coalesce(p_description, '')), ''), array_to_string(v_titles, ' · ')),
    v_allocations, v_total, v_started, v_ended,
    case when v_use_timer then 'timer' end,
    case when v_use_timer then v_segments end
  ) returning * into e;

  update public.hours_drafts set submitted_at = v_now
  where id = any (v_ids);
  return e;
end;
$$;

-- TimeService.addManual: registro manual de una fecha (con o sin hora de inicio).
create function public.add_manual_hours(
  p_task uuid,
  p_date date,
  p_hours numeric,
  p_project uuid default null,
  p_description text default null,
  p_evidence_url text default null,
  p_start_time text default null
) returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task public.tasks;
  v_start timestamptz;
  e public.time_entries;
begin
  if public.auth_role() is null then
    raise exception 'Inicia sesion para continuar';
  end if;
  if p_task is not null then
    select * into v_task from public.tasks where id = p_task;
    if not found then
      raise exception 'La tarea no existe';
    end if;
    if v_task.assignee_id is distinct from v_uid then
      raise exception 'Solo puedes trabajar en tus tareas asignadas';
    end if;
  end if;
  if p_project is not null and p_task is null and not public.can_access_project(p_project) then
    raise exception 'No tienes acceso a este proyecto';
  end if;
  if p_task is null and char_length(btrim(coalesce(p_description, ''))) < 8 then
    raise exception 'Describe el trabajo realizado';
  end if;
  perform private.assert_activity(p_project, p_evidence_url);
  perform private.assert_hours(p_hours);
  if p_date is null or p_date > private.lima_date(clock_timestamp()) then
    raise exception 'No puedes registrar horas en una fecha futura';
  end if;
  if p_start_time is not null and p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Fecha u hora no valida';
  end if;
  -- Lima no tiene horario de verano: el mediodia de ese dia es una hora segura.
  v_start := (p_date + coalesce(p_start_time, '12:00')::time) at time zone 'America/Lima';
  if p_start_time is not null then
    perform private.assert_interval(v_start, p_hours, v_uid);
  end if;

  insert into public.time_entries (
    user_id, task_id, project_id, description, evidence_url, source, started_at, ended_at, hours
  ) values (
    v_uid, p_task, coalesce(v_task.project_id, p_project),
    coalesce(nullif(btrim(p_description), ''), v_task.title), nullif(p_evidence_url, ''),
    case when p_start_time is not null then 'manual' end,
    v_start, v_start + p_hours * interval '1 hour', p_hours
  ) returning * into e;

  -- Confirmar a mano una tarea reemplaza su sugerencia pendiente (evita doble registro).
  if p_task is not null then
    update public.hours_drafts set submitted_at = clock_timestamp()
    where user_id = v_uid and task_id = p_task and submitted_at is null;
  end if;
  return e;
end;
$$;

-- TimeService.update. p_patch usa las claves del dominio: taskId, hours, startedAt,
-- description, projectId, evidenceUrl (una clave ausente = no cambia; null = vaciar).
create function public.update_hours(p_id uuid, p_patch jsonb) returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  e public.time_entries;
  v_task_id uuid;
  v_started timestamptz;
  v_hours numeric;
  v_ratio numeric;
begin
  select * into e from public.time_entries where id = p_id;
  if not found then
    raise exception 'El registro no existe';
  end if;
  if e.user_id <> v_uid then
    raise exception 'Solo puedes modificar tus propios registros';
  end if;
  if e.ended_at is null then
    raise exception 'Deten el temporizador antes de editar el registro';
  end if;
  if not private.can_edit_entry(e.created_at, e.voided_at, e.paid, e.review_note) then
    raise exception
      'Este registro ya no se puede editar: pasaron los dias permitidos o esta pagado/anulado';
  end if;

  v_task_id := case when p_patch ? 'taskId' then nullif(p_patch ->> 'taskId', '')::uuid else e.task_id end;
  if v_task_id is not null and p_patch ? 'taskId' and not exists (
    select 1 from public.tasks t where t.id = v_task_id and t.assignee_id = v_uid
  ) then
    raise exception 'Solo puedes trabajar en tus tareas asignadas';
  end if;
  v_hours := coalesce((p_patch ->> 'hours')::numeric, e.hours);
  if p_patch ? 'hours' then
    perform private.assert_hours(v_hours);
  end if;
  perform private.assert_activity(
    case when p_patch ? 'projectId' then nullif(p_patch ->> 'projectId', '')::uuid end,
    p_patch ->> 'evidenceUrl'
  );
  if p_patch ? 'description' and char_length(btrim(coalesce(p_patch ->> 'description', ''))) < 8 then
    raise exception 'Describe el trabajo realizado';
  end if;
  if p_patch ? 'taskId' and v_task_id is null
     and char_length(coalesce(btrim(p_patch ->> 'description'), e.description, '')) < 8 then
    raise exception 'Describe el trabajo realizado';
  end if;
  v_started := coalesce((p_patch ->> 'startedAt')::timestamptz, e.started_at);
  perform private.assert_interval(v_started, v_hours, v_uid, e.id);

  if e.allocations is not null and jsonb_array_length(e.allocations) > 0
     and p_patch ? 'taskId' and v_task_id is distinct from e.task_id then
    raise exception 'Conserva las tareas de este registro agrupado';
  end if;
  v_ratio := case when e.hours > 0 then v_hours / e.hours else 1 end;

  update public.time_entries set
    task_id = v_task_id,
    project_id = case when p_patch ? 'projectId' then nullif(p_patch ->> 'projectId', '')::uuid
                      else project_id end,
    description = coalesce(btrim(p_patch ->> 'description'), description),
    evidence_url = case when p_patch ? 'evidenceUrl' then nullif(p_patch ->> 'evidenceUrl', '')
                        else evidence_url end,
    hours = v_hours,
    started_at = v_started,
    ended_at = v_started + v_hours * interval '1 hour',
    source = case when nullif(p_patch ->> 'startedAt', '') is not null then 'manual' else source end,
    segments = case when p_patch ? 'startedAt' or p_patch ? 'hours' then null else segments end,
    allocations = case
      when allocations is not null and jsonb_array_length(allocations) > 0 then (
        select jsonb_agg(jsonb_set(a, '{hours}', to_jsonb((a ->> 'hours')::numeric * v_ratio)))
        from jsonb_array_elements(allocations) a)
      else allocations end
  where id = e.id returning * into e;
  return e;
end;
$$;

-- TimeService.void: nadie borra; se anula con motivo.
create function public.void_hours(p_id uuid, p_reason text) returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.time_entries;
begin
  select * into e from public.time_entries where id = p_id;
  if not found then
    raise exception 'El registro no existe';
  end if;
  if e.user_id <> (select auth.uid()) then
    raise exception 'Solo puedes modificar tus propios registros';
  end if;
  if e.voided_at is not null then
    raise exception 'El registro ya esta anulado';
  end if;
  if e.validated then
    raise exception 'No se puede anular un registro validado';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Escribe el motivo de la anulacion';
  end if;
  update public.time_entries set voided_at = clock_timestamp(), void_reason = btrim(p_reason)
  where id = p_id returning * into e;
  return e;
end;
$$;

-- TimeService.validate: aprueba registros finalizados de otras personas (socios/admin).
create function public.validate_hours(p_ids uuid[]) returns setof public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ids uuid[] := (select coalesce(array_agg(distinct x), '{}') from unnest(p_ids) x);
  v_id uuid;
  e public.time_entries;
begin
  if not public.is_partner_or_admin() then
    raise exception 'Tu rol no permite esta accion';
  end if;
  foreach v_id in array v_ids loop
    select * into e from public.time_entries where id = v_id;
    if not found or e.draft or e.voided_at is not null or e.ended_at is null or e.hours <= 0 then
      raise exception 'Solo se revisan registros finalizados y vigentes';
    end if;
    if e.user_id = v_uid then
      raise exception 'No puedes aprobar tus propias horas';
    end if;
    if e.validated then
      raise exception 'El registro ya esta aprobado';
    end if;
  end loop;
  update public.time_entries set validated = true where id = any (v_ids);
  return query select * from public.time_entries where id = any (v_ids);
end;
$$;

-- TimeService.requestClarification
create function public.request_hours_clarification(p_id uuid, p_note text)
returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.time_entries;
begin
  if not public.is_partner_or_admin() then
    raise exception 'Tu rol no permite esta accion';
  end if;
  select * into e from public.time_entries where id = p_id;
  if not found or e.draft or e.user_id = (select auth.uid()) or e.validated
     or e.voided_at is not null or e.ended_at is null then
    raise exception 'Este registro no esta disponible para revision';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 8 then
    raise exception 'Explica que necesita aclaracion';
  end if;
  update public.time_entries set review_note = btrim(p_note) where id = p_id returning * into e;
  return e;
end;
$$;

-- TaskService.move: mismo efecto que un UPDATE de `status` (la guarda aplica los permisos).
create function public.move_task(p_id uuid, p_status public.task_status)
returns public.tasks
language plpgsql security invoker set search_path = ''
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_id;
  if not found then
    raise exception 'La tarea no existe';
  end if;
  if t.status = p_status then
    return t;
  end if;
  update public.tasks set status = p_status where id = p_id returning * into t;
  return t;
end;
$$;

-- TaskService.update/create con etiquetas: deja exactamente ese conjunto de etiquetas.
create function public.set_task_labels(p_task uuid, p_label_ids uuid[])
returns uuid[]
language plpgsql security invoker set search_path = ''
as $$
begin
  delete from public.task_labels tl
  where tl.task_id = p_task and not (tl.label_id = any (p_label_ids));
  insert into public.task_labels (task_id, label_id)
  select p_task, l from (select distinct unnest(p_label_ids) as l) s
  on conflict do nothing;
  return (select coalesce(array_agg(tl.label_id order by tl.label_id), '{}')
          from public.task_labels tl where tl.task_id = p_task);
end;
$$;

revoke execute on function
  public.start_timer(uuid, text, uuid, text), public.pause_timer(), public.resume_timer(),
  public.stop_timer(), public.submit_hours_drafts(jsonb, date, text),
  public.add_manual_hours(uuid, date, numeric, uuid, text, text, text),
  public.update_hours(uuid, jsonb), public.void_hours(uuid, text),
  public.validate_hours(uuid[]), public.request_hours_clarification(uuid, text),
  public.move_task(uuid, public.task_status), public.set_task_labels(uuid, uuid[])
  from public, anon;
grant execute on function
  public.start_timer(uuid, text, uuid, text), public.pause_timer(), public.resume_timer(),
  public.stop_timer(), public.submit_hours_drafts(jsonb, date, text),
  public.add_manual_hours(uuid, date, numeric, uuid, text, text, text),
  public.update_hours(uuid, jsonb), public.void_hours(uuid, text),
  public.validate_hours(uuid[]), public.request_hours_clarification(uuid, text),
  public.move_task(uuid, public.task_status), public.set_task_labels(uuid, uuid[])
  to authenticated;
grant execute on function
  private.assert_activity(uuid, text), private.assert_hours(numeric),
  private.assert_interval(timestamptz, numeric, uuid, uuid) to authenticated;
