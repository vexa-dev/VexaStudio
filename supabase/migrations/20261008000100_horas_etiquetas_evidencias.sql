-- Horas: etiquetas con porcentaje y archivos de evidencia con retencion.
--
-- ETIQUETAS. Al registrar horas (manual, desde borradores o despues) quien las registra puede etiquetar
-- hasta 10 integrantes activos que ayudaron y fijar, por persona, que porcentaje (1-100) de las horas
-- del registro cuenta para ella. El dueno conserva siempre el 100 %. Las horas acreditadas a la persona
-- etiquetada (`horas x porcentaje / 100`) cuentan para los puntos (solo si el registro esta validado, no
-- pagado y no anulado) y para el minimo mensual (solo si esta validado y vigente). El conteo lee el
-- estado vivo del registro: si la aprobacion se corrige y vuelve a pendiente, el credito desaparece.
--   * Solo el dueno cambia etiquetas, mientras el registro sea editable (misma regla que update_hours).
--     Cambiar etiquetas o evidencia de un registro aprobado lo devuelve a pendiente, como editar horas.
--   * Quien aparece etiquetado no puede aprobar ni pedir aclaracion (se amplia la regla de autoaprobacion).
--   * La persona etiquetada ve el registro, sus etiquetas y su evidencia (tambien un colaborador).
--
-- EVIDENCIA. Ademas del enlace `evidence_url`, el dueno adjunta hasta 5 imagenes o documentos por
-- registro en el bucket privado `hours-evidence` (10 MiB c/u, lista cerrada de tipos, sin ejecutables ni
-- svg). Ruta `<registro>/<id de evidencia>/<archivo>`. Ve los archivos quien ve el registro (URL firmada).
-- Retencion: al validar el registro se guardan 7 dias y luego se retiran; al revertir la validacion se
-- limpia la fecha; al anular el registro el archivo es retirable de inmediato.
-- Los objetos se retiran con la API de Storage desde el cliente, nunca con SQL sobre `storage.objects`
-- (dejaria el archivo huerfano). Es el mismo patron del ciclo de adjuntos del chat: ayudante "purgeable",
-- politica DELETE de storage que solo se abre cuando vence, y una guarda que registra `purged_at` solo
-- cuando el objeto ya no existe. Sin cron: el barrido lo hace el cliente al abrir Horas.

-- ---------------------------------------------------------------------------
-- Constantes en un solo lugar
-- ---------------------------------------------------------------------------
create function private.evidence_retention_days() returns integer
language sql immutable set search_path = ''
as $$ select 7 $$;

create function private.evidence_mimes() returns text[]
language sql immutable set search_path = ''
as $$
  select array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv'
  ]
$$;
revoke execute on function private.evidence_retention_days(), private.evidence_mimes()
  from public, anon, authenticated;

-- Objetos del bucket en la carpeta de un registro. Es una funcion (no una subconsulta en la politica):
-- una politica de storage.objects que consulta storage.objects entra en recursion. SECURITY INVOKER:
-- cuenta lo que ve quien llama (el dueno ve sus propios objetos).
create function private.evidence_object_count(p_entry text) returns integer
language plpgsql stable security invoker set search_path = ''
as $$
begin
  return (select count(*)::integer from storage.objects o
    where o.bucket_id = 'hours-evidence' and (storage.foldername(o.name))[1] = p_entry);
end;
$$;
revoke execute on function private.evidence_object_count(text) from public, anon;
grant execute on function private.evidence_object_count(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.time_entry_participants (
  entry_id uuid not null references public.time_entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  share_percent smallint not null default 100
    constraint time_entry_participants_share_percent_check check (share_percent between 1 and 100),
  created_at timestamptz not null default clock_timestamp(),
  primary key (entry_id, user_id)
);
create index time_entry_participants_user_idx on public.time_entry_participants (user_id);

create table public.time_entry_evidence (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.time_entries (id) on delete cascade,
  -- La guarda lo vuelve a fijar con auth.uid(); el default evita que el cliente deba enviarlo.
  uploader_id uuid not null default auth.uid() references public.profiles (id),
  path text not null unique,
  name text not null constraint time_entry_evidence_name_check check (char_length(name) between 1 and 255),
  mime text not null,
  size bigint not null
    constraint time_entry_evidence_size_check check (size > 0 and size <= 10485760),
  created_at timestamptz not null default clock_timestamp(),
  -- Cuando el archivo pasa a ser retirable (la fija el servidor segun la revision del registro).
  purge_after timestamptz,
  -- Cuando el objeto ya no existe en Storage (la guarda lo registra solo si ya no existe).
  purged_at timestamptz
);
create index time_entry_evidence_entry_idx on public.time_entry_evidence (entry_id);

revoke all on public.time_entry_participants, public.time_entry_evidence from public, anon, authenticated;
grant select, delete on public.time_entry_participants to authenticated;
grant insert (entry_id, user_id, share_percent), update (share_percent)
  on public.time_entry_participants to authenticated;
-- id lo elige el cliente (forma parte de la ruta del objeto); uploader_id y las fechas las fija la guarda.
grant select, delete on public.time_entry_evidence to authenticated;
grant insert (id, entry_id, path, name, mime, size), update (purged_at)
  on public.time_entry_evidence to authenticated;

alter table public.time_entry_participants enable row level security;
alter table public.time_entry_evidence enable row level security;

-- ---------------------------------------------------------------------------
-- Ayudantes de permisos
-- ---------------------------------------------------------------------------
-- La persona que llama aparece etiquetada en el registro. SECURITY DEFINER para que la politica de
-- time_entries no entre en recursion con la de time_entry_participants; solo responde sobre quien llama.
create function public.hours_entry_tagged(p_entry uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.auth_role() is not null and exists (
    select 1 from public.time_entry_participants p
    where p.entry_id = p_entry and p.user_id = (select auth.uid()))
$$;
revoke execute on function public.hours_entry_tagged(uuid) from public, anon;
grant execute on function public.hours_entry_tagged(uuid) to authenticated;

-- La evidencia ya puede retirarse del almacenamiento (SECURITY INVOKER: aplica el RLS de quien consulta).
create function public.hours_evidence_purgeable(p_evidence uuid) returns boolean
language sql stable security invoker set search_path = ''
as $$
  select coalesce((
    select ev.purged_at is null and ev.purge_after is not null and ev.purge_after <= clock_timestamp()
    from public.time_entry_evidence ev where ev.id = p_evidence
  ), false)
$$;
revoke execute on function public.hours_evidence_purgeable(uuid) from public, anon;
grant execute on function public.hours_evidence_purgeable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Las personas etiquetadas ven el registro (no los borradores del reloj, que son solo del dueno).
alter policy time_entries_select on public.time_entries
  using (
    public.auth_role() is not null and (
      user_id = (select auth.uid())
      or (public.is_partner_or_admin() and not draft)
      or (not draft and public.hours_entry_tagged(id))
    )
  );

-- Lo que ve el registro, lo ven sus etiquetas y su evidencia (el RLS de time_entries decide).
create policy time_entry_participants_select on public.time_entry_participants for select to authenticated
  using (public.auth_role() is not null and exists (
    select 1 from public.time_entries e where e.id = time_entry_participants.entry_id));
create policy time_entry_participants_insert_own on public.time_entry_participants for insert to authenticated
  with check (exists (select 1 from public.time_entries e
    where e.id = time_entry_participants.entry_id and e.user_id = (select auth.uid())));
create policy time_entry_participants_update_own on public.time_entry_participants for update to authenticated
  using (exists (select 1 from public.time_entries e
    where e.id = time_entry_participants.entry_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from public.time_entries e
    where e.id = time_entry_participants.entry_id and e.user_id = (select auth.uid())));
create policy time_entry_participants_delete_own on public.time_entry_participants for delete to authenticated
  using (exists (select 1 from public.time_entries e
    where e.id = time_entry_participants.entry_id and e.user_id = (select auth.uid())));

create policy time_entry_evidence_select on public.time_entry_evidence for select to authenticated
  using (public.auth_role() is not null and exists (
    select 1 from public.time_entries e where e.id = time_entry_evidence.entry_id));
create policy time_entry_evidence_insert_own on public.time_entry_evidence for insert to authenticated
  with check (uploader_id = (select auth.uid()) and exists (select 1 from public.time_entries e
    where e.id = time_entry_evidence.entry_id and e.user_id = (select auth.uid())));
-- Registrar el retiro: cualquiera que ve el registro (la guarda exige vencimiento y objeto ausente).
create policy time_entry_evidence_update_viewer on public.time_entry_evidence for update to authenticated
  using (public.auth_role() is not null and exists (
    select 1 from public.time_entries e where e.id = time_entry_evidence.entry_id))
  with check (exists (select 1 from public.time_entries e where e.id = time_entry_evidence.entry_id));
create policy time_entry_evidence_delete_own on public.time_entry_evidence for delete to authenticated
  using (uploader_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Guarda de etiquetas
-- ---------------------------------------------------------------------------
create function private.participants_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_entry uuid := case tg_op when 'DELETE' then old.entry_id else new.entry_id end;
  e public.time_entries;
begin
  if v_uid is null or coalesce(current_setting('vexa.internal', true), '') = 'on' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  select * into e from public.time_entries where id = v_entry for update;
  if not found or e.user_id <> v_uid then
    raise exception 'Solo puedes modificar tus propios registros' using errcode = '42501';
  end if;
  if e.draft or e.ended_at is null then
    raise exception 'Confirma el registro antes de etiquetar a otras personas.' using errcode = '42501';
  end if;
  if not private.can_edit_entry(e.created_at, e.voided_at, e.paid, e.review_note) then
    raise exception
      'Este registro ya no se puede editar: pasaron los dias permitidos o esta pagado/anulado'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if (new.entry_id, new.user_id, new.created_at) is distinct from (old.entry_id, old.user_id, old.created_at) then
      raise exception 'Solo se puede cambiar el porcentaje de una etiqueta' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.user_id = e.user_id then
    raise exception 'No puedes etiquetarte a ti mismo' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.active) then
    raise exception 'La persona etiquetada no esta disponible' using errcode = '23514';
  end if;
  if (select count(*) from public.time_entry_participants x where x.entry_id = new.entry_id) >= 10 then
    raise exception 'Puedes etiquetar hasta 10 personas' using errcode = '23514';
  end if;
  new.created_at := clock_timestamp();
  return new;
end;
$$;
revoke execute on function private.participants_guard() from public, anon, authenticated;
create trigger participants_guard before insert or update or delete on public.time_entry_participants
  for each row execute function private.participants_guard();

-- ---------------------------------------------------------------------------
-- Guarda de evidencia
-- ---------------------------------------------------------------------------
create function private.evidence_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  e public.time_entries;
  v_prefix text;
  v_file text;
  v_size text;
  v_found boolean;
begin
  if v_uid is null or coalesce(current_setting('vexa.internal', true), '') = 'on' then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    -- Solo se registra el retiro: nada mas cambia desde el cliente.
    if (new.id, new.entry_id, new.uploader_id, new.path, new.name, new.mime, new.size, new.created_at,
        new.purge_after) is distinct from
       (old.id, old.entry_id, old.uploader_id, old.path, old.name, old.mime, old.size, old.created_at,
        old.purge_after) then
      raise exception 'Solo se puede registrar el retiro del archivo' using errcode = '42501';
    end if;
    if new.purged_at is not distinct from old.purged_at then
      return new;
    end if;
    if old.purged_at is not null or new.purged_at is null then
      raise exception 'El archivo ya fue eliminado para liberar espacio.' using errcode = '42501';
    end if;
    if old.purge_after is null or old.purge_after > clock_timestamp() then
      raise exception 'Todavia no es momento de retirar el archivo.' using errcode = '42501';
    end if;
    if exists (select 1 from storage.objects o where o.bucket_id = 'hours-evidence' and o.name = old.path) then
      raise exception 'El archivo todavia esta en el almacenamiento.' using errcode = '42501';
    end if;
    new.purged_at := clock_timestamp();
    return new;
  end if;

  select * into e from public.time_entries
  where id = case tg_op when 'DELETE' then old.entry_id else new.entry_id end;
  if not found or e.user_id <> v_uid then
    raise exception 'Solo puedes modificar tus propios registros' using errcode = '42501';
  end if;
  if not private.can_edit_entry(e.created_at, e.voided_at, e.paid, e.review_note) then
    raise exception
      'Este registro ya no se puede editar: pasaron los dias permitidos o esta pagado/anulado'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if old.purged_at is not null then
      raise exception 'El archivo ya fue eliminado para liberar espacio.' using errcode = '42501';
    end if;
    -- Primero se quita el objeto con la API de Storage; la fila solo se borra cuando ya no existe.
    if exists (select 1 from storage.objects o where o.bucket_id = 'hours-evidence' and o.name = old.path) then
      raise exception 'Quita primero el archivo del almacenamiento.' using errcode = '42501';
    end if;
    return old;
  end if;

  -- INSERT
  if e.draft or e.ended_at is null then
    raise exception 'Confirma el registro antes de adjuntar archivos.' using errcode = '42501';
  end if;
  new.uploader_id := v_uid;
  new.name := btrim(coalesce(new.name, ''));
  if char_length(new.name) not between 1 and 255 or new.name ~ '[/\\]' then
    raise exception 'El nombre del archivo debe tener de 1 a 255 caracteres.' using errcode = '23514';
  end if;
  v_prefix := new.entry_id::text || '/' || new.id::text || '/';
  if new.path is null or left(new.path, char_length(v_prefix)) <> v_prefix
     or char_length(new.path) <= char_length(v_prefix)
     or position('/' in substr(new.path, char_length(v_prefix) + 1)) > 0 then
    raise exception 'El archivo no corresponde a este registro.' using errcode = '23514';
  end if;
  v_file := substr(new.path, char_length(v_prefix) + 1);
  if new.mime is null or new.mime <> all (private.evidence_mimes())
     or new.name ~* '\.(exe|dll|bat|cmd|com|msi|sh|js|mjs|jar|svg|svgz|html?|apk|scr|ps1|vbs|app|dmg|bin)$'
     or v_file ~* '\.(exe|dll|bat|cmd|com|msi|sh|js|mjs|jar|svg|svgz|html?|apk|scr|ps1|vbs|app|dmg|bin)$' then
    raise exception 'Este tipo de archivo no esta permitido.' using errcode = '23514';
  end if;
  if new.size is null or new.size <= 0 or new.size > 10485760 then
    raise exception 'El archivo esta vacio o pesa demasiado.' using errcode = '23514';
  end if;
  if (select count(*) from public.time_entry_evidence x
      where x.entry_id = new.entry_id and x.purged_at is null) >= 5 then
    raise exception 'Cada registro admite hasta 5 archivos.' using errcode = '23514';
  end if;
  select true, o.metadata ->> 'size' into v_found, v_size
  from storage.objects o where o.bucket_id = 'hours-evidence' and o.name = new.path;
  if v_found is not true then
    raise exception 'El archivo adjunto no existe en el almacenamiento.' using errcode = '23514';
  end if;
  if v_size ~ '^[0-9]+$' and v_size::bigint <> new.size then
    raise exception 'El tamano del archivo no coincide con el subido.' using errcode = '23514';
  end if;
  new.created_at := clock_timestamp();
  new.purge_after := null;
  new.purged_at := null;
  return new;
end;
$$;
revoke execute on function private.evidence_guard() from public, anon, authenticated;
create trigger evidence_guard before insert or update or delete on public.time_entry_evidence
  for each row execute function private.evidence_guard();

-- ---------------------------------------------------------------------------
-- Cambiar etiquetas o evidencia de un registro aprobado lo devuelve a pendiente
-- ---------------------------------------------------------------------------
-- Igual que editar las horas (guarda de time_entries): un cambio que altera quien recibe puntos reabre la
-- revision. Corre como propietaria con la marca interna porque el dueno no toca columnas de revision.
create function private.reset_review_on_children_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('vexa.internal', true), '');
  v_entry uuid := case tg_op when 'DELETE' then old.entry_id else new.entry_id end;
begin
  if (select auth.uid()) is null or v_prev = 'on' then
    return null;
  end if;
  perform set_config('vexa.internal', 'on', true);
  update public.time_entries set
    validated = false, validated_at = null, validated_by = null, reviewed_by = null
  where id = v_entry and validated and voided_at is null and not paid;
  perform set_config('vexa.internal', v_prev, true);
  return null;
end;
$$;
revoke execute on function private.reset_review_on_children_change() from public, anon, authenticated;
create trigger participants_reset_review after insert or update or delete on public.time_entry_participants
  for each row execute function private.reset_review_on_children_change();
create trigger evidence_reset_review after insert or delete on public.time_entry_evidence
  for each row execute function private.reset_review_on_children_change();

-- ---------------------------------------------------------------------------
-- Retencion: fecha de retiro segun la revision del registro
-- ---------------------------------------------------------------------------
create function private.evidence_retention_sync() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('vexa.internal', true), '');
begin
  perform set_config('vexa.internal', 'on', true);
  if new.voided_at is not null and old.voided_at is null then
    -- Anulado: el archivo ya no sirve a nadie.
    update public.time_entry_evidence set purge_after = clock_timestamp()
    where entry_id = new.id and purged_at is null;
  elsif new.validated and not old.validated then
    update public.time_entry_evidence
    set purge_after = clock_timestamp() + make_interval(days => private.evidence_retention_days())
    where entry_id = new.id and purged_at is null;
  elsif old.validated and not new.validated and new.voided_at is null then
    update public.time_entry_evidence set purge_after = null
    where entry_id = new.id and purged_at is null;
  end if;
  perform set_config('vexa.internal', v_prev, true);
  return null;
end;
$$;
revoke execute on function private.evidence_retention_sync() from public, anon, authenticated;
-- Sin lista de columnas: la guarda de time_entries cambia `validated` dentro del trigger BEFORE (p. ej. al
-- editar horas), y `UPDATE OF` solo mira las columnas del SET original.
create trigger time_entries_evidence_retention after update on public.time_entries
  for each row
  when (old.validated is distinct from new.validated or old.voided_at is distinct from new.voided_at)
  execute function private.evidence_retention_sync();

-- ---------------------------------------------------------------------------
-- Quien aparece etiquetado no revisa ese registro (guarda directa; las RPC repiten el mensaje)
-- ---------------------------------------------------------------------------
create function private.time_entries_tagged_review_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or coalesce(current_setting('vexa.internal', true), '') = 'on'
     or v_uid = old.user_id then
    return new;
  end if;
  if (new.validated, new.review_note) is distinct from (old.validated, old.review_note)
     and exists (select 1 from public.time_entry_participants p
       where p.entry_id = old.id and p.user_id = v_uid) then
    raise exception 'No puedes revisar horas en las que estas etiquetado' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.time_entries_tagged_review_guard() from public, anon, authenticated;
create trigger time_entries_tagged_review_guard before update on public.time_entries
  for each row execute function private.time_entries_tagged_review_guard();

-- ---------------------------------------------------------------------------
-- Aviso a la persona etiquetada (tipo `mention`: el enum no se toca)
-- ---------------------------------------------------------------------------
create function private.notify_hours_tagged() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor public.profiles;
  v_recipient text;
  e public.time_entries;
  v_credit text;
begin
  select * into e from public.time_entries where id = new.entry_id;
  select * into v_actor from public.profiles p where p.id = e.user_id;
  select p.name into v_recipient from public.profiles p where p.id = new.user_id;
  v_credit := trim(to_char(e.hours * new.share_percent / 100.0, 'FM990.00'));
  v_credit := regexp_replace(v_credit, '\.?0+$', '');
  perform private.notify(new.user_id, 'mention', jsonb_strip_nulls(jsonb_build_object(
    'title', 'Te etiquetaron en horas',
    'message', left(v_actor.name, 120) || ' te etiquetó en un registro de horas: te acredita '
      || v_credit || ' h (' || new.share_percent || ' %).',
    'actorName', left(v_actor.name, 120),
    'actorRole', private.notify_role_label(v_actor.role),
    'recipientName', left(v_recipient, 120),
    'entryId', e.id::text,
    'details', 'Las horas acreditadas cuentan para tus puntos y tu mínimo mensual cuando otro socio apruebe el registro.',
    'nextStep', 'Abre Horas para ver el registro y su evidencia.'
  )));
  return null;
end;
$$;
revoke execute on function private.notify_hours_tagged() from public, anon, authenticated;
create trigger participants_notify after insert on public.time_entry_participants
  for each row execute function private.notify_hours_tagged();

-- ---------------------------------------------------------------------------
-- Auditoria: las etiquetas y la evidencia se ven como una edicion del registro (hours.edited)
-- ---------------------------------------------------------------------------
-- Misma foto de antes, mas `participants` y `evidence`. La cadena de hashes no cambia.
create or replace function private.audit_snapshot(p_table text, p_row jsonb) returns jsonb
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
      return private.camelize(p_row) || jsonb_build_object(
        'participants', coalesce((
          select jsonb_agg(jsonb_build_object('userId', x.user_id, 'sharePercent', x.share_percent)
            order by x.user_id)
          from public.time_entry_participants x where x.entry_id = (p_row ->> 'id')::uuid
        ), '[]'::jsonb),
        'evidence', coalesce((
          select jsonb_agg(jsonb_build_object('id', ev.id, 'name', ev.name) order by ev.id)
          from public.time_entry_evidence ev
          where ev.entry_id = (p_row ->> 'id')::uuid and ev.purged_at is null
        ), '[]'::jsonb));
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

-- Registra la edicion de un registro cuando cambian sus etiquetas o su evidencia. `p_before` es el valor
-- de esa clave ANTES del cambio; el resto de la foto es el estado actual.
create function private.audit_hours_children(p_entry uuid, p_key text, p_before jsonb) returns void
language plpgsql security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  e public.time_entries;
  v_after jsonb;
  v_before jsonb;
begin
  select * into e from public.time_entries where id = p_entry;
  if not found then
    return;
  end if;
  v_after := private.audit_snapshot('time_entries', to_jsonb(e));
  v_before := jsonb_set(v_after, array[p_key], coalesce(p_before, '[]'::jsonb));
  if v_before = v_after then
    return;
  end if;
  perform private.audit_append(
    'hours.edited', 'time_entries', e.id::text, e.project_id,
    coalesce(nullif(e.description, ''), 'Registro de horas'),
    private.audit_diff(v_before, v_after), v_before, v_after
  );
end;
$$;
revoke execute on function private.audit_hours_children(uuid, text, jsonb) from public, anon, authenticated;

-- Etiquetas: una entrada por registro y sentencia (como las etiquetas de tarea y los miembros).
-- Antes = estado actual sin las filas nuevas, mas las filas anteriores.
create function private.audit_participants_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_entry uuid;
  v_before jsonb;
begin
  if tg_op = 'INSERT' then
    for v_entry in select distinct n.entry_id from new_rows n loop
      select coalesce(jsonb_agg(jsonb_build_object('userId', x.user_id, 'sharePercent', x.share_percent)
        order by x.user_id), '[]'::jsonb) into v_before
      from public.time_entry_participants x
      where x.entry_id = v_entry
        and x.user_id not in (select n.user_id from new_rows n where n.entry_id = v_entry);
      perform private.audit_hours_children(v_entry, 'participants', v_before);
    end loop;
  elsif tg_op = 'DELETE' then
    for v_entry in select distinct o.entry_id from old_rows o loop
      select coalesce(jsonb_agg(jsonb_build_object('userId', b.user_id, 'sharePercent', b.share_percent)
        order by b.user_id), '[]'::jsonb) into v_before
      from (
        select x.user_id, x.share_percent from public.time_entry_participants x where x.entry_id = v_entry
        union all
        select o.user_id, o.share_percent from old_rows o where o.entry_id = v_entry
      ) b;
      perform private.audit_hours_children(v_entry, 'participants', v_before);
    end loop;
  else
    for v_entry in select distinct o.entry_id from old_rows o loop
      select coalesce(jsonb_agg(jsonb_build_object('userId', b.user_id, 'sharePercent', b.share_percent)
        order by b.user_id), '[]'::jsonb) into v_before
      from (
        select x.user_id, x.share_percent from public.time_entry_participants x
        where x.entry_id = v_entry
          and x.user_id not in (select o.user_id from old_rows o where o.entry_id = v_entry)
        union all
        select o.user_id, o.share_percent from old_rows o where o.entry_id = v_entry
      ) b;
      perform private.audit_hours_children(v_entry, 'participants', v_before);
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.audit_participants_change() from public, anon, authenticated;
create trigger audit_participants_ins after insert on public.time_entry_participants
  referencing new table as new_rows for each statement
  execute function private.audit_participants_change();
create trigger audit_participants_upd after update on public.time_entry_participants
  referencing old table as old_rows new table as new_rows for each statement
  execute function private.audit_participants_change();
create trigger audit_participants_del after delete on public.time_entry_participants
  referencing old table as old_rows for each statement
  execute function private.audit_participants_change();

-- Evidencia: una entrada por archivo. Antes = estado actual sin este archivo, mas este archivo como
-- estaba si seguia vigente.
create function private.audit_evidence_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_entry uuid := case tg_op when 'DELETE' then old.entry_id else new.entry_id end;
  v_row uuid := case tg_op when 'DELETE' then old.id else new.id end;
  v_before jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', ev.id, 'name', ev.name) order by ev.id), '[]'::jsonb)
  into v_before
  from public.time_entry_evidence ev
  where ev.entry_id = v_entry and ev.purged_at is null and ev.id <> v_row;
  if tg_op <> 'INSERT' and old.purged_at is null then
    select coalesce(jsonb_agg(x order by x ->> 'id'), '[]'::jsonb) into v_before
    from jsonb_array_elements(v_before || jsonb_build_array(
      jsonb_build_object('id', old.id, 'name', old.name))) x;
  end if;
  perform private.audit_hours_children(v_entry, 'evidence', v_before);
  return null;
end;
$$;
revoke execute on function private.audit_evidence_change() from public, anon, authenticated;
create trigger audit_evidence after insert or update or delete on public.time_entry_evidence
  for each row execute function private.audit_evidence_change();

-- ---------------------------------------------------------------------------
-- RPC de etiquetas (SECURITY INVOKER: el RLS y las guardas deciden)
-- ---------------------------------------------------------------------------
-- p_participants: [{"userId": "<uuid>", "sharePercent": 75}, ...]; sharePercent ausente = 100.
-- Deja exactamente ese conjunto: quita a quien no esta, cambia porcentajes y agrega a quien falta.
create function private.apply_participants(p_entry uuid, p_participants jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_item jsonb;
  v_user uuid;
  v_share jsonb;
  v_ids uuid[] := '{}';
begin
  if p_participants is null then
    p_participants := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_participants) <> 'array' then
    raise exception 'Las personas etiquetadas no son validas';
  end if;
  if jsonb_array_length(p_participants) > 10 then
    raise exception 'Puedes etiquetar hasta 10 personas';
  end if;
  for v_item in select * from jsonb_array_elements(p_participants) loop
    if jsonb_typeof(v_item) <> 'object' or coalesce(v_item ->> 'userId', '')
         !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Las personas etiquetadas no son validas';
    end if;
    v_user := (v_item ->> 'userId')::uuid;
    if v_user = any (v_ids) then
      raise exception 'No repitas a una persona';
    end if;
    v_ids := v_ids || v_user;
    v_share := v_item -> 'sharePercent';
    if v_share is not null and jsonb_typeof(v_share) <> 'null' and (
         jsonb_typeof(v_share) <> 'number'
         or (v_share #>> '{}')::numeric <> trunc((v_share #>> '{}')::numeric)
         or (v_share #>> '{}')::numeric not between 1 and 100) then
      raise exception 'El porcentaje debe ser un entero entre 1 y 100';
    end if;
  end loop;

  delete from public.time_entry_participants x
  where x.entry_id = p_entry and x.user_id <> all (v_ids);
  update public.time_entry_participants x
  set share_percent = r.share
  from (select (i ->> 'userId')::uuid as uid,
               coalesce(nullif(i ->> 'sharePercent', '')::numeric, 100)::smallint as share
        from jsonb_array_elements(p_participants) i) r
  where x.entry_id = p_entry and x.user_id = r.uid and x.share_percent <> r.share;
  insert into public.time_entry_participants (entry_id, user_id, share_percent)
  select p_entry, (i ->> 'userId')::uuid,
         coalesce(nullif(i ->> 'sharePercent', '')::numeric, 100)::smallint
  from jsonb_array_elements(p_participants) i
  where not exists (select 1 from public.time_entry_participants x
    where x.entry_id = p_entry and x.user_id = (i ->> 'userId')::uuid);
end;
$$;
revoke execute on function private.apply_participants(uuid, jsonb) from public, anon;
grant execute on function private.apply_participants(uuid, jsonb) to authenticated;

-- TimeService.setParticipants
create function public.set_hours_participants(p_entry uuid, p_participants jsonb)
returns public.time_entries
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.time_entries;
begin
  select * into e from public.time_entries where id = p_entry;
  if not found then
    raise exception 'El registro no existe';
  end if;
  if e.user_id <> (select auth.uid()) then
    raise exception 'Solo puedes modificar tus propios registros';
  end if;
  perform private.apply_participants(p_entry, p_participants);
  select * into e from public.time_entries where id = p_entry;
  return e;
end;
$$;
revoke execute on function public.set_hours_participants(uuid, jsonb) from public, anon;
grant execute on function public.set_hours_participants(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Crear registros con etiquetas: se agrega `p_participants` a las dos RPC de creacion
-- ---------------------------------------------------------------------------
-- Es la misma funcion de C20 con un parametro opcional al final (se reemplaza, no se sobrecarga: un
-- segundo overload dejaria ambigua la llamada por nombres de PostgREST).
drop function public.submit_hours_drafts(jsonb, date, text);
create function public.submit_hours_drafts(
  p_items jsonb, p_date date, p_description text default null, p_participants jsonb default null
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
  if p_participants is not null then
    perform private.apply_participants(e.id, p_participants);
  end if;
  return e;
end;
$$;

drop function public.add_manual_hours(uuid, date, numeric, uuid, text, text, text);
create function public.add_manual_hours(
  p_task uuid,
  p_date date,
  p_hours numeric,
  p_project uuid default null,
  p_description text default null,
  p_evidence_url text default null,
  p_start_time text default null,
  p_participants jsonb default null
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
  if p_participants is not null then
    perform private.apply_participants(e.id, p_participants);
  end if;
  return e;
end;
$$;

revoke execute on function
  public.submit_hours_drafts(jsonb, date, text, jsonb),
  public.add_manual_hours(uuid, date, numeric, uuid, text, text, text, jsonb)
  from public, anon;
grant execute on function
  public.submit_hours_drafts(jsonb, date, text, jsonb),
  public.add_manual_hours(uuid, date, numeric, uuid, text, text, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Revision: quien aparece etiquetado no aprueba ni pide aclaracion (misma funcion + una regla)
-- ---------------------------------------------------------------------------
create or replace function public.validate_hours(p_ids uuid[]) returns setof public.time_entries
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
    if exists (select 1 from public.time_entry_participants p
        where p.entry_id = v_id and p.user_id = v_uid) then
      raise exception 'No puedes aprobar horas en las que estas etiquetado';
    end if;
    if e.validated then
      raise exception 'El registro ya esta aprobado';
    end if;
  end loop;
  update public.time_entries set validated = true where id = any (v_ids);
  return query select * from public.time_entries where id = any (v_ids);
end;
$$;

create or replace function public.request_hours_clarification(p_id uuid, p_note text)
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
  if exists (select 1 from public.time_entry_participants p
      where p.entry_id = p_id and p.user_id = (select auth.uid())) then
    raise exception 'No puedes aprobar horas en las que estas etiquetado';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 8 then
    raise exception 'Explica que necesita aclaracion';
  end if;
  update public.time_entries set review_note = btrim(p_note) where id = p_id returning * into e;
  return e;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteo: horas acreditadas a las personas etiquetadas
-- ---------------------------------------------------------------------------
-- Mismas reglas que C21 (ver 20261004000300). Cambia el origen de las filas por persona: el dueno cuenta
-- sus horas completas (como antes) y cada persona etiquetada cuenta `horas x porcentaje / 100` de los
-- registros VALIDADOS. Los puntos exigen ademas no pagado (igual que el dueno).
create or replace function public.monthly_summary(p_month text)
returns table (
  user_id uuid,
  month text,
  hours numeric,
  minimum_hours numeric,
  compliance numeric,
  meets_minimum boolean
)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mes no valido: usa YYYY-MM';
  end if;
  if not public.is_partner_or_admin() then
    return;
  end if;
  return query
  with b as (
    select ((p_month || '-01')::date)::timestamp at time zone 'America/Lima' as t_from,
           (((p_month || '-01')::date + interval '1 month'))::timestamp
             at time zone 'America/Lima' as t_to
  ),
  base_entries as (
    select e.id, e.user_id, e.hours, e.source, e.started_at, e.ended_at, e.segments, e.validated
    from public.time_entries e
    where not e.draft and e.voided_at is null and e.ended_at is not null and e.hours > 0
  ),
  credited as (
    select be.id, be.user_id, be.hours, be.source, be.started_at, be.ended_at, be.segments
    from base_entries be
    union all
    select be.id, p.user_id, be.hours * p.share_percent / 100.0, be.source, be.started_at, be.ended_at,
           be.segments
    from base_entries be
    join public.time_entry_participants p on p.entry_id = be.id
    where be.validated
  ),
  entries as (
    select c.id, c.user_id, c.hours, c.source, c.started_at,
           case when jsonb_array_length(coalesce(c.segments, '[]'::jsonb)) > 0 then c.segments
                else jsonb_build_array(jsonb_build_object('start', c.started_at, 'end', c.ended_at))
           end as segs
    from credited c
  ),
  segs as (
    select en.id, en.user_id, en.hours,
           (s ->> 'start')::timestamptz as s_start, (s ->> 'end')::timestamptz as s_end
    from entries en cross join lateral jsonb_array_elements(en.segs) s
    where en.source is not null
  ),
  timed as (
    select g.user_id,
           case when g.total_s > 0 then
             greatest(0, extract(epoch from least(g.s_end, b.t_to) - greatest(g.s_start, b.t_from)))
             / g.total_s * g.hours
           else 0 end as h
    from (
      select sg.*, sum(greatest(0, extract(epoch from sg.s_end - sg.s_start)))
                     over (partition by sg.id, sg.user_id) as total_s
      from segs sg
    ) g cross join b
  ),
  legacy as (
    select en.user_id, en.hours as h
    from entries en
    where en.source is null
      and to_char(en.started_at at time zone 'America/Lima', 'YYYY-MM') = p_month
  ),
  month_hours as (
    select u.user_id, sum(u.h) as h from (
      select * from timed union all select * from legacy
    ) u group by u.user_id
  ),
  reduced as (
    select a.user_id, sum(a.reduced_hours) as h
    from public.absences a
    where to_char(a.from_date, 'YYYY-MM') = p_month
    group by a.user_id
  ),
  base as (
    select p.id as uid,
           coalesce(mh.h, 0) as hrs,
           greatest(0, round(
             p.weekly_hours * st.weeks_per_month * st.min_compliance - coalesce(r.h, 0), 2
           )) as minimum
    from public.profiles p
    cross join public.settings st
    left join month_hours mh on mh.user_id = p.id
    left join reduced r on r.user_id = p.id
    where p.active and p.role <> 'collaborator'
  )
  select base.uid, p_month, base.hrs, base.minimum,
         case when base.minimum <= 0 then 1::numeric else base.hrs / base.minimum end,
         case when base.minimum <= 0 then true else base.hrs >= base.minimum end
  from base
  order by base.uid;
end;
$$;

create or replace view public.member_points with (security_invoker = true) as
with partners as (
  select p.id as user_id from public.profiles p where p.active and p.role <> 'collaborator'
),
hour_pts as (
  select c.user_id, sum(c.h * st.points_per_hour) as pts
  from (
    select e.user_id, e.hours as h
    from public.time_entries e
    where not e.paid and e.validated and e.voided_at is null
    union all
    select p.user_id, e.hours * p.share_percent / 100.0
    from public.time_entries e
    join public.time_entry_participants p on p.entry_id = e.id
    where not e.paid and e.validated and e.voided_at is null
  ) c cross join public.settings st
  group by c.user_id
),
money_pts as (
  select x.paid_by as user_id, sum(x.amount * st.points_per_sol) as pts
  from public.expenses x cross join public.settings st
  where x.currency = 'PEN' and x.status = 'approved'
    and not x.reimbursed and not x.before_signing
  group by x.paid_by
),
per_member as (
  select pa.user_id,
         coalesce(h.pts, 0) as hour_points,
         coalesce(m.pts, 0) as money_points
  from partners pa
  left join hour_pts h on h.user_id = pa.user_id
  left join money_pts m on m.user_id = pa.user_id
),
total as (
  select coalesce(sum(hour_points + money_points), 0) as pts from per_member
)
select pm.user_id,
       pm.hour_points,
       pm.money_points,
       pm.hour_points + pm.money_points as total_points,
       case when t.pts = 0 then 0::numeric
            else (pm.hour_points + pm.money_points) / t.pts end as participation
from per_member pm cross join total t
where public.is_partner_or_admin();

-- ---------------------------------------------------------------------------
-- Storage: bucket privado y politicas
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hours-evidence', 'hours-evidence', false, 10485760, private.evidence_mimes())
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- La primera carpeta es el id del registro y la segunda el de la evidencia. Si no parecen uuid la
-- politica es falsa (el CASE evita que el cast falle con rutas raras).
create policy hours_evidence_select on storage.objects for select to authenticated
  using (
    bucket_id = 'hours-evidence' and public.auth_role() is not null
    and case when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      -- El RLS de time_entries decide quien ve el registro (dueno, etiquetados, socios y admin).
      then exists (select 1 from public.time_entries e where e.id = ((storage.foldername(name))[1])::uuid)
      else false end
  );

-- Subir: solo el dueno, mientras el registro sea editable, en su carpeta, hasta 5 objetos por registro.
create policy hours_evidence_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hours-evidence' and public.auth_role() is not null
    and case when array_length(storage.foldername(name), 1) = 2
        and (storage.foldername(name))[1]
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (storage.foldername(name))[2]
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (select 1 from public.time_entries e
          where e.id = ((storage.foldername(name))[1])::uuid and e.user_id = (select auth.uid())
            and not e.draft and e.ended_at is not null
            and private.can_edit_entry(e.created_at, e.voided_at, e.paid, e.review_note))
        and private.evidence_object_count((storage.foldername(name))[1]) < 5
      else false end
  );

-- Quitar el propio archivo: el dueno, mientras el registro sea editable.
create policy hours_evidence_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'hours-evidence' and public.auth_role() is not null
    and case when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (select 1 from public.time_entries e
          where e.id = ((storage.foldername(name))[1])::uuid and e.user_id = (select auth.uid())
            and private.can_edit_entry(e.created_at, e.voided_at, e.paid, e.review_note))
      else false end
  );

-- Retiro por retencion: cualquiera que ve el registro, SOLO cuando el archivo ya vencio (7 dias tras
-- validar, o de inmediato si el registro se anulo). Se suma (OR) a la baja propia.
create policy hours_evidence_delete_due on storage.objects for delete to authenticated
  using (
    bucket_id = 'hours-evidence' and public.auth_role() is not null
    and exists (select 1 from public.time_entry_evidence ev
      where ev.path = storage.objects.name and public.hours_evidence_purgeable(ev.id))
  );
