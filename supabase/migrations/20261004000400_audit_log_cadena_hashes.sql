-- C22: registro de actividad (audit_log) inmutable, con cadena de hashes.
--
-- Espejo de packages/domain/src/audit.ts: los mismos 26 tipos de evento y la misma derivacion
-- que `taskEventType` / `recordAudit` del mock (apps/web/src/services/mock/audit.ts).
-- Solo escribe el trigger `private.audit_append` (SECURITY DEFINER): nadie inserta, edita ni
-- borra entradas. La lectura y los privilegios finales llegan en C23.
--
-- `seq` es monotono SIN HUECOS: se asigna bajo bloqueo de la fila unica de audit_chain_head
-- (una secuencia comun deja huecos al revertir). Cada entrada encadena el hash de la anterior:
--   hash = sha256(prev_hash || texto canonico de la fila)
-- y verify_audit_chain() recorre la cadena y devuelve el primer seq roto.
--
-- Cabeceras que el cliente debe enviar (todas opcionales, nunca de confianza para la hora):
--   x-request-id  agrupa las entradas de una misma operacion de servicio
--   x-client      `<plataforma>/<version>`, p. ej. `web/1.0.0` (web | desktop | mobile)
--   x-client-at   hora del reloj del cliente (informativa; occurred_at es del servidor)
-- Sin usuario (rol de servicio, consola) actor_id/actor_role quedan en NULL = "sistema".

create type public.audit_event_type as enum (
  'task.created', 'task.edited', 'task.moved', 'task.assigned',
  'project.created', 'project.updated', 'project.members_changed',
  'project_label.created', 'project_label.updated',
  'sprint.created',
  'hours.created', 'hours.confirmed', 'hours.edited', 'hours.approved',
  'hours.clarification_requested', 'hours.voided',
  'timer.started', 'timer.stopped', 'timer.paused', 'timer.resumed', 'timer.recovered',
  'member.created', 'member.updated', 'member.role_changed', 'member.deactivated',
  'settings.changed'
);

-- Cabeza de la cadena: una sola fila, bloqueada FOR UPDATE por cada escritura del log.
create table public.audit_chain_head (
  id boolean primary key default true check (id),
  seq bigint not null default 0,
  hash text not null default repeat('0', 64)
);
insert into public.audit_chain_head default values;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  seq bigint not null unique check (seq > 0),
  -- Hora del servidor (clock_timestamp), nunca del cliente.
  occurred_at timestamptz not null,
  client_at timestamptz,
  actor_id uuid references public.profiles (id),
  actor_role public.user_role,
  event_type public.audit_event_type not null,
  entity_table text not null check (entity_table in (
    'tasks', 'projects', 'project_labels', 'sprints', 'time_entries', 'profiles', 'settings'
  )),
  entity_id text not null,
  project_id uuid,
  entity_label text not null,
  -- [{field, from, to}] campo a campo, como diffFields.
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  before jsonb,
  after jsonb,
  reason text,
  request_id text not null,
  session_id text,
  client_platform text not null,
  client_version text not null,
  prev_hash text not null,
  hash text not null
);
create index audit_log_entity_idx on public.audit_log (entity_table, entity_id, seq);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at);
create index audit_log_project_idx on public.audit_log (project_id, seq);

-- ---------------------------------------------------------------------------
-- Utilidades de formato y diff (puras)
-- ---------------------------------------------------------------------------
create function private.iso_us(p_ts timestamptz) returns text
language sql immutable parallel safe set search_path = ''
as $$ select to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') $$;

-- snake_case -> camelCase (las claves de los snapshots son las del dominio).
create function private.camel(p_key text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select split_part(p_key, '_', 1) || coalesce((
    select string_agg(upper(left(x, 1)) || substr(x, 2), '' order by ord)
    from unnest(string_to_array(p_key, '_')) with ordinality t(x, ord)
    where ord > 1
  ), '')
$$;

create function private.camelize(p_row jsonb) returns jsonb
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(jsonb_object_agg(private.camel(k), v), '{}'::jsonb) from jsonb_each(p_row) as t(k, v)
$$;

-- Cambios campo a campo; un campo ausente cuenta como null (igual que diffFields).
create function private.audit_diff(p_before jsonb, p_after jsonb, p_ignore text[] default '{}')
returns jsonb
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'field', k,
    'from', coalesce(p_before -> k, 'null'::jsonb),
    'to', coalesce(p_after -> k, 'null'::jsonb)
  ) order by k), '[]'::jsonb)
  from (
    select jsonb_object_keys(coalesce(p_before, '{}'::jsonb)) as k
    union
    select jsonb_object_keys(coalesce(p_after, '{}'::jsonb))
  ) keys
  where k <> all (p_ignore)
    and coalesce(p_before -> k, 'null'::jsonb) is distinct from coalesce(p_after -> k, 'null'::jsonb)
$$;

-- Etiquetas de una tarea como en Task.labels del dominio.
create function private.audit_labels_json(p_label_ids uuid[]) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'projectId', l.project_id, 'name', l.name, 'color', l.color
  ) order by l.name, l.id), '[]'::jsonb)
  from public.project_labels l where l.id = any (p_label_ids)
$$;

-- Foto de un registro con la forma del dominio (camelCase, sin marcas internas).
create function private.audit_snapshot(p_table text, p_row jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- settings tiene id booleano: solo tareas y proyectos lo usan como uuid.
  if p_table in ('tasks', 'projects') then
    v_id := (p_row ->> 'id')::uuid;
  end if;
  case p_table
    when 'tasks' then
      return private.camelize(p_row - 'updated_at' - 'created_at') || jsonb_build_object(
        'labels', private.audit_labels_json(coalesce((
          select array_agg(tl.label_id) from public.task_labels tl where tl.task_id = v_id
        ), '{}')));
    when 'projects' then
      return private.camelize(p_row - 'updated_at' - 'created_at') || jsonb_build_object(
        'memberIds', coalesce((
          select jsonb_agg(m.user_id order by m.user_id)
          from public.project_members m where m.project_id = v_id
        ), '[]'::jsonb));
    when 'project_labels', 'sprints', 'profiles' then
      return private.camelize(p_row - 'updated_at' - 'created_at');
    when 'time_entries' then
      return private.camelize(p_row);
    when 'settings' then
      return jsonb_build_object(
        'pointsPerHour', p_row -> 'points_per_hour',
        'pointsPerSol', p_row -> 'points_per_sol',
        'minCompliance', p_row -> 'min_compliance',
        'weeksPerMonth', p_row -> 'weeks_per_month',
        'expenseApprovalLimitPen', p_row -> 'expense_approval_limit_pen',
        'entryEditDays', p_row -> 'entry_edit_days',
        'dailyReminder', jsonb_build_object(
          'time', to_char((p_row ->> 'daily_reminder_time')::time, 'HH24:MI'),
          'weekdays', p_row -> 'daily_reminder_weekdays'),
        'weeklyHoursReminder', jsonb_build_object(
          'time', to_char((p_row ->> 'weekly_hours_reminder_time')::time, 'HH24:MI'),
          'weekday', p_row -> 'weekly_hours_reminder_weekday'));
    else
      raise exception 'Tabla sin auditoria: %', p_table;
  end case;
end;
$$;

-- Evento semantico segun lo que cambio (misma derivacion que audit.ts / el mock).
create function private.audit_event(
  p_table text, p_op text, p_old jsonb, p_new jsonb, p_fields text[]
) returns public.audit_event_type
language plpgsql immutable set search_path = ''
as $$
begin
  case p_table
    when 'tasks' then
      if p_op = 'INSERT' then return 'task.created'::public.audit_event_type; end if;
      if p_fields = array['status'] then return 'task.moved'::public.audit_event_type; end if;
      if p_fields = array['assigneeId'] then return 'task.assigned'::public.audit_event_type; end if;
      return 'task.edited'::public.audit_event_type;
    when 'projects' then
      if p_op = 'INSERT' then return 'project.created'::public.audit_event_type; end if;
      if p_fields = array['memberIds'] then return 'project.members_changed'::public.audit_event_type; end if;
      return 'project.updated'::public.audit_event_type;
    when 'project_labels' then
      return case when p_op = 'INSERT' then 'project_label.created'::public.audit_event_type
                  else 'project_label.updated'::public.audit_event_type end;
    when 'sprints' then
      return 'sprint.created'::public.audit_event_type;
    when 'time_entries' then
      if p_op = 'INSERT' then
        if p_new ->> 'timerState' is not null then return 'timer.started'::public.audit_event_type; end if;
        if jsonb_typeof(p_new -> 'allocations') = 'array' then return 'hours.confirmed'::public.audit_event_type; end if;
        return 'hours.created'::public.audit_event_type;
      end if;
      if p_old ->> 'endedAt' is null and p_new ->> 'endedAt' is not null then
        return 'timer.stopped'::public.audit_event_type;
      elsif p_old ->> 'timerState' = 'running' and p_new ->> 'timerState' = 'paused' then
        return 'timer.paused'::public.audit_event_type;
      elsif p_old ->> 'timerState' = 'paused' and p_new ->> 'timerState' = 'running' then
        return 'timer.resumed'::public.audit_event_type;
      elsif p_old ->> 'voidedAt' is null and p_new ->> 'voidedAt' is not null then
        return 'hours.voided'::public.audit_event_type;
      elsif (p_old ->> 'validated')::boolean is false and (p_new ->> 'validated')::boolean is true then
        return 'hours.approved'::public.audit_event_type;
      elsif p_new ->> 'reviewNote' is not null
            and p_new ->> 'reviewNote' is distinct from p_old ->> 'reviewNote' then
        return 'hours.clarification_requested'::public.audit_event_type;
      end if;
      return 'hours.edited'::public.audit_event_type;
    when 'profiles' then
      if p_op = 'INSERT' then return 'member.created'::public.audit_event_type; end if;
      if (p_old ->> 'active')::boolean is true and (p_new ->> 'active')::boolean is false then
        return 'member.deactivated'::public.audit_event_type;
      end if;
      if p_fields = array['role'] then return 'member.role_changed'::public.audit_event_type; end if;
      return 'member.updated'::public.audit_event_type;
    when 'settings' then
      return 'settings.changed'::public.audit_event_type;
    else
      raise exception 'Tabla sin auditoria: %', p_table;
  end case;
end;
$$;

-- Hash de una entrada: sha256(prev_hash || texto canonico). El texto canonico es un arreglo
-- jsonb con todos los campos en orden fijo (jsonb::text es determinista y no ambiguo).
create function private.audit_row_hash(p_prev text, r public.audit_log) returns text
language sql immutable set search_path = ''
as $$
  select encode(extensions.digest(
    coalesce(p_prev, '') || jsonb_build_array(
      r.id, r.seq, private.iso_us(r.occurred_at), private.iso_us(r.client_at),
      r.actor_id, r.actor_role, r.event_type, r.entity_table, r.entity_id, r.project_id,
      r.entity_label, r.changes, r.before, r.after, r.reason, r.request_id, r.session_id,
      r.client_platform, r.client_version
    )::text, 'sha256'), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- Escritor unico
-- ---------------------------------------------------------------------------
create function private.audit_append(
  p_event public.audit_event_type,
  p_table text,
  p_entity_id text,
  p_project uuid,
  p_label text,
  p_changes jsonb,
  p_before jsonb,
  p_after jsonb,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  h public.audit_chain_head;
  r public.audit_log;
  v_uid uuid := (select auth.uid());
  v_headers jsonb;
  v_claims jsonb;
  v_client text;
  v_req text;
begin
  -- Serializa todas las escrituras del log: seq sin huecos.
  select * into h from public.audit_chain_head where id for update;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    v_claims := null;
  end;

  v_req := left(nullif(btrim(v_headers ->> 'x-request-id'), ''), 100);
  if v_req is null then
    v_req := nullif(current_setting('vexa.request_id', true), '');
    if v_req is null then
      v_req := gen_random_uuid()::text;
      perform set_config('vexa.request_id', v_req, true);
    end if;
  end if;

  v_client := nullif(btrim(v_headers ->> 'x-client'), '');
  r.client_platform := case
    when split_part(v_client, '/', 1) in ('web', 'desktop', 'mobile') then split_part(v_client, '/', 1)
    when v_uid is null then 'system'
    else 'unknown'
  end;
  r.client_version := left(coalesce(split_part(v_client, '/', 2), ''), 40);
  begin
    r.client_at := (v_headers ->> 'x-client-at')::timestamptz;
  exception when others then
    r.client_at := null;
  end;

  r.id := gen_random_uuid();
  r.seq := h.seq + 1;
  r.occurred_at := clock_timestamp();
  r.actor_id := v_uid;
  r.actor_role := (select p.role from public.profiles p where p.id = v_uid);
  r.event_type := p_event;
  r.entity_table := p_table;
  r.entity_id := p_entity_id;
  r.project_id := p_project;
  r.entity_label := p_label;
  r.changes := p_changes;
  r.before := p_before;
  r.after := p_after;
  r.reason := p_reason;
  r.request_id := v_req;
  r.session_id := left(v_claims ->> 'session_id', 100);
  r.prev_hash := h.hash;
  r.hash := private.audit_row_hash(h.hash, r);

  insert into public.audit_log values (r.*);
  update public.audit_chain_head set seq = r.seq, hash = r.hash where id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers de fila (tareas, proyectos, etiquetas, sprints, horas, perfiles, ajustes)
-- ---------------------------------------------------------------------------
create function private.audit_row_trigger() returns trigger
language plpgsql security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_fields text[];
  v_row jsonb := to_jsonb(new);
  v_event public.audit_event_type;
  v_reason text;
begin
  v_new := private.audit_snapshot(tg_table_name, v_row);
  if tg_op = 'UPDATE' then
    v_old := private.audit_snapshot(tg_table_name, to_jsonb(old));
  end if;
  -- `hoursPrepared` es una marca interna: no cuenta como cambio (mover a hecho sigue
  -- siendo task.moved).
  v_changes := private.audit_diff(
    v_old, v_new, case when tg_table_name = 'tasks' then array['hoursPrepared'] else '{}' end
  );
  if tg_op = 'UPDATE' and jsonb_array_length(v_changes) = 0 then
    return null;
  end if;
  select coalesce(array_agg(c ->> 'field'), '{}') into v_fields from jsonb_array_elements(v_changes) c;
  v_event := private.audit_event(tg_table_name, tg_op, v_old, v_new, v_fields);
  v_reason := case v_event
    when 'hours.voided' then v_row ->> 'void_reason'
    when 'hours.clarification_requested' then v_row ->> 'review_note'
  end;

  perform private.audit_append(
    v_event,
    tg_table_name,
    case tg_table_name when 'settings' then 'settings' else v_row ->> 'id' end,
    case tg_table_name
      when 'projects' then (v_row ->> 'id')::uuid
      when 'tasks' then (v_row ->> 'project_id')::uuid
      when 'project_labels' then (v_row ->> 'project_id')::uuid
      when 'sprints' then (v_row ->> 'project_id')::uuid
      when 'time_entries' then (v_row ->> 'project_id')::uuid
    end,
    case tg_table_name
      when 'tasks' then coalesce(v_row ->> 'title', '')
      when 'projects' then coalesce(v_row ->> 'name', '')
      when 'project_labels' then coalesce(v_row ->> 'name', '')
      when 'profiles' then coalesce(v_row ->> 'name', '')
      when 'sprints' then coalesce(v_row ->> 'goal', '')
      when 'time_entries' then coalesce(nullif(v_row ->> 'description', ''), 'Registro de horas')
      else 'Ajustes'
    end,
    v_changes, v_old, v_new, v_reason
  );
  return null;
end;
$$;

create trigger audit_tasks after insert or update on public.tasks
  for each row execute function private.audit_row_trigger();
create trigger audit_projects after insert or update on public.projects
  for each row execute function private.audit_row_trigger();
create trigger audit_project_labels after insert or update on public.project_labels
  for each row execute function private.audit_row_trigger();
-- Los sprints solo registran su creacion (el cierre aun no existe en el mock).
create trigger audit_sprints after insert on public.sprints
  for each row execute function private.audit_row_trigger();
create trigger audit_time_entries after insert or update on public.time_entries
  for each row execute function private.audit_row_trigger();
create trigger audit_profiles after insert or update on public.profiles
  for each row execute function private.audit_row_trigger();
create trigger audit_settings after insert or update on public.settings
  for each row execute function private.audit_row_trigger();

-- ---------------------------------------------------------------------------
-- Tablas de union: membresias y etiquetas se registran como edicion del registro padre
-- (project.members_changed / task.edited), con una entrada por tarea o proyecto y sentencia.
-- ---------------------------------------------------------------------------
create function private.audit_members_change(p_project uuid, p_changed uuid[], p_added boolean)
returns void
language plpgsql security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  v_proj public.projects;
  v_after uuid[];
  v_before uuid[];
  v_snap_after jsonb;
  v_snap_before jsonb;
begin
  select * into v_proj from public.projects where id = p_project;
  select coalesce(array_agg(m.user_id order by m.user_id), '{}') into v_after
  from public.project_members m where m.project_id = p_project;
  v_before := case
    when p_added then (select coalesce(array_agg(x order by x), '{}') from unnest(v_after) x
                       where x <> all (p_changed))
    else (select coalesce(array_agg(x order by x), '{}') from (
            select unnest(v_after) union select unnest(p_changed)) s(x))
  end;
  v_snap_after := private.audit_snapshot('projects', to_jsonb(v_proj));
  v_snap_before := jsonb_set(v_snap_after, '{memberIds}', to_jsonb(v_before));
  if v_snap_before = v_snap_after then
    return;
  end if;
  perform private.audit_append(
    'project.members_changed', 'projects', v_proj.id::text, v_proj.id, v_proj.name,
    private.audit_diff(v_snap_before, v_snap_after), v_snap_before, v_snap_after
  );
end;
$$;

create function private.audit_project_members_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select distinct project_id from new_rows loop
    perform private.audit_members_change(
      v_id, (select array_agg(user_id) from new_rows where project_id = v_id), true);
  end loop;
  return null;
end;
$$;
create function private.audit_project_members_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select distinct project_id from old_rows loop
    perform private.audit_members_change(
      v_id, (select array_agg(user_id) from old_rows where project_id = v_id), false);
  end loop;
  return null;
end;
$$;
create trigger audit_project_members_ins after insert on public.project_members
  referencing new table as new_rows for each statement
  execute function private.audit_project_members_insert();
create trigger audit_project_members_del after delete on public.project_members
  referencing old table as old_rows for each statement
  execute function private.audit_project_members_delete();

create function private.audit_labels_change(p_task uuid, p_changed uuid[], p_added boolean)
returns void
language plpgsql security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  v_task public.tasks;
  v_after uuid[];
  v_before uuid[];
  v_snap_after jsonb;
  v_snap_before jsonb;
begin
  select * into v_task from public.tasks where id = p_task;
  select coalesce(array_agg(tl.label_id), '{}') into v_after
  from public.task_labels tl where tl.task_id = p_task;
  v_before := case
    when p_added then (select coalesce(array_agg(x), '{}') from unnest(v_after) x
                       where x <> all (p_changed))
    else (select coalesce(array_agg(x), '{}') from (
            select unnest(v_after) union select unnest(p_changed)) s(x))
  end;
  v_snap_after := private.audit_snapshot('tasks', to_jsonb(v_task));
  v_snap_before := jsonb_set(v_snap_after, '{labels}', private.audit_labels_json(v_before));
  if v_snap_before = v_snap_after then
    return;
  end if;
  perform private.audit_append(
    'task.edited', 'tasks', v_task.id::text, v_task.project_id, v_task.title,
    private.audit_diff(v_snap_before, v_snap_after, array['hoursPrepared']),
    v_snap_before, v_snap_after
  );
end;
$$;

create function private.audit_task_labels_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select distinct task_id from new_rows loop
    perform private.audit_labels_change(
      v_id, (select array_agg(label_id) from new_rows where task_id = v_id), true);
  end loop;
  return null;
end;
$$;
create function private.audit_task_labels_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select distinct task_id from old_rows loop
    perform private.audit_labels_change(
      v_id, (select array_agg(label_id) from old_rows where task_id = v_id), false);
  end loop;
  return null;
end;
$$;
create trigger audit_task_labels_ins after insert on public.task_labels
  referencing new table as new_rows for each statement
  execute function private.audit_task_labels_insert();
create trigger audit_task_labels_del after delete on public.task_labels
  referencing old table as old_rows for each statement
  execute function private.audit_task_labels_delete();

-- ---------------------------------------------------------------------------
-- Solo anade: UPDATE, DELETE y TRUNCATE se rechazan para todos
-- ---------------------------------------------------------------------------
create function private.audit_log_append_only() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'El registro de actividad es de solo lectura: solo se agregan entradas'
    using errcode = '42501';
end;
$$;
create trigger audit_log_no_update_delete before update or delete on public.audit_log
  for each row execute function private.audit_log_append_only();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_log_append_only();

-- ---------------------------------------------------------------------------
-- Verificacion de la cadena: primer seq roto, o NULL si esta integra. Solo admin
-- (o rol de servicio / consola, sin usuario).
-- ---------------------------------------------------------------------------
create function public.verify_audit_chain() returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.audit_log;
  h public.audit_chain_head;
  v_expected bigint := 1;
  v_prev text := repeat('0', 64);
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Solo un administrador verifica la cadena' using errcode = '42501';
  end if;
  for r in select * from public.audit_log order by seq loop
    if r.seq <> v_expected or r.prev_hash <> v_prev
       or r.hash <> private.audit_row_hash(v_prev, r) then
      return v_expected;
    end if;
    v_prev := r.hash;
    v_expected := v_expected + 1;
  end loop;
  select * into h from public.audit_chain_head where id;
  if h.seq <> v_expected - 1 or h.hash <> v_prev then
    return v_expected;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios base (C23 concede la lectura por rol) y RLS activado sin politicas
-- ---------------------------------------------------------------------------
revoke all on public.audit_log, public.audit_chain_head
  from public, anon, authenticated, service_role;
alter table public.audit_log enable row level security;
alter table public.audit_chain_head enable row level security;

revoke execute on function public.verify_audit_chain() from public, anon;
grant execute on function public.verify_audit_chain() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime: el RLS sigue aplicando a cada suscriptor
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['audit_log', 'tasks', 'time_entries', 'expenses'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
