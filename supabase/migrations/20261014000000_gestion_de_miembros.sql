-- C1: gestion de miembros. Invitar vive en la Edge Function `members-admin`; aqui quedan el cambio de
-- rol y la (des)activacion como RPC SECURITY INVOKER (las politicas de profiles siguen aplicando:
-- solo admin actualiza) y una guarda de tabla que impide, aun con UPDATE directo, que una persona
-- cambie su propio rol/estado o que el estudio se quede sin administrador activo.
-- Una persona inactiva ya pierde el acceso: `auth_role()` devuelve NULL para perfiles inactivos y toda
-- politica pasa por ese ayudante (lo verifica el pgTAP 27). No se agrega ninguna tabla.

-- ---------------------------------------------------------------------------
-- Auditoria: el motivo/nota del RPC queda en audit_log.reason (perfiles)
-- ---------------------------------------------------------------------------
create or replace function private.audit_row_trigger() returns trigger
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
  -- Gestion de miembros (C1): el RPC deja el motivo o la nota en `vexa.audit_reason` (solo vive en la
  -- transaccion) y la fila de auditoria del perfil lo guarda como `reason`.
  if tg_table_name = 'profiles' then
    v_reason := coalesce(nullif(btrim(coalesce(current_setting('vexa.audit_reason', true), '')), ''), v_reason);
  end if;

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

-- ---------------------------------------------------------------------------
-- Guarda de tabla (SECURITY INVOKER): invariantes que valen para cualquier UPDATE con sesion
-- ---------------------------------------------------------------------------
-- Sin sesion (auth.uid() nulo: seed, mantenimiento como postgres/service_role) no aplica. Es AFTER para
-- que el WITH CHECK de las politicas (RLS) responda primero: esta guarda es la segunda barrera.
create function private.profiles_member_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return null;
  end if;
  if new.role is not distinct from old.role and new.active is not distinct from old.active then
    return null;
  end if;
  if new.id = v_uid then
    if new.role is distinct from old.role then
      raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
    end if;
    raise exception 'No puedes desactivarte a ti mismo' using errcode = '42501';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from public.profiles p where p.role = 'admin' and p.active and p.id <> old.id
     ) then
    raise exception 'Debe quedar al menos un administrador activo' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke execute on function private.profiles_member_guard() from public, anon, authenticated;
create trigger profiles_member_guard after update on public.profiles
  for each row execute function private.profiles_member_guard();

-- ---------------------------------------------------------------------------
-- RPC: cambiar el rol de otra persona
-- ---------------------------------------------------------------------------
create function public.set_member_role(
  p_member uuid,
  p_role public.user_role,
  p_note text default null
) returns public.profiles
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_target public.profiles;
  v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador gestiona al equipo' using errcode = '42501';
  end if;
  if p_member is null or p_role is null then
    raise exception 'Miembro no valido' using errcode = '22023';
  end if;
  if p_member = v_uid then
    raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'El motivo puede tener hasta 280 caracteres' using errcode = '22001';
  end if;
  select * into v_target from public.profiles where id = p_member;
  if not found then
    raise exception 'Miembro no valido' using errcode = '22023';
  end if;
  if not v_target.active then
    raise exception 'Reactiva a la persona antes de cambiar su rol' using errcode = '23514';
  end if;
  if v_target.role = p_role then
    return v_target;
  end if;
  if v_target.role = 'admin' and not exists (
    select 1 from public.profiles p where p.role = 'admin' and p.active and p.id <> p_member
  ) then
    raise exception 'Debe quedar al menos un administrador activo' using errcode = '23514';
  end if;
  perform set_config('vexa.audit_reason', coalesce(v_note, ''), true);
  update public.profiles set role = p_role where id = p_member returning * into v_row;
  perform set_config('vexa.audit_reason', '', true);
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: desactivar (con motivo) o reactivar a otra persona
-- ---------------------------------------------------------------------------
-- Desactivar no borra nada: `auth_role()` pasa a NULL y la persona deja de ver y escribir datos. Cerrar
-- sus sesiones es trabajo de la Edge Function (API de administracion), que se llama despues.
create function public.set_member_active(
  p_member uuid,
  p_active boolean,
  p_reason text default null
) returns public.profiles
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_target public.profiles;
  v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador gestiona al equipo' using errcode = '42501';
  end if;
  if p_member is null or p_active is null then
    raise exception 'Miembro no valido' using errcode = '22023';
  end if;
  if p_member = v_uid then
    raise exception 'No puedes desactivarte a ti mismo' using errcode = '42501';
  end if;
  if not p_active and v_reason is null then
    raise exception 'Escribe el motivo de la desactivacion' using errcode = '23514';
  end if;
  if v_reason is not null and char_length(v_reason) > 280 then
    raise exception 'El motivo puede tener hasta 280 caracteres' using errcode = '22001';
  end if;
  select * into v_target from public.profiles where id = p_member;
  if not found then
    raise exception 'Miembro no valido' using errcode = '22023';
  end if;
  if v_target.active = p_active then
    return v_target;
  end if;
  if not p_active and v_target.role = 'admin' and not exists (
    select 1 from public.profiles p where p.role = 'admin' and p.active and p.id <> p_member
  ) then
    raise exception 'Debe quedar al menos un administrador activo' using errcode = '23514';
  end if;
  perform set_config('vexa.audit_reason', coalesce(v_reason, ''), true);
  update public.profiles set active = p_active where id = p_member returning * into v_row;
  perform set_config('vexa.audit_reason', '', true);
  return v_row;
end;
$$;

revoke execute on function public.set_member_role(uuid, public.user_role, text),
  public.set_member_active(uuid, boolean, text) from public, anon;
grant execute on function public.set_member_role(uuid, public.user_role, text),
  public.set_member_active(uuid, boolean, text) to authenticated;
