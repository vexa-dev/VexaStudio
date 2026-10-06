-- C30: configuracion del perfil (P2).
--
-- 1) Datos personales propios: `username` (unico sin distinguir mayusculas) y `bio` ("Sobre mi").
--    Cada persona edita solo su nombre, usuario y bio con `public.update_my_profile`. Es SECURITY
--    INVOKER a proposito (el barrido 06 solo admite como SECURITY DEFINER publicas los ayudantes de
--    permisos) y usa el mismo patron que `set_profile_media`: la politica `profiles_update_self` solo
--    se cumple dentro de la funcion (marca de transaccion `vexa.profile_self_rpc`) y, aun con la
--    marca, exige que rol, area, horas, activo y rutas de imagen queden como estaban. La auditoria
--    sigue siendo el trigger existente: el evento es `member.updated` y nunca lleva bytes de imagen.
-- 2) Preferencias de notificacion por persona (`notification_preferences`). Solo `task_assigned` tiene
--    efecto hoy (el trigger lo respeta). `hours_reminder` y `weekly_summary` se guardan, pero aun no
--    existe un aviso por reloj que los consuma: los tipos con planificador siguen diferidos (ver
--    CLAUDE.md, seccion "Supabase local").

-- ---------------------------------------------------------------------------
-- profiles: usuario y bio
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column username text,
  add column bio text;

-- El formato obliga a minusculas; el indice unico sobre lower() lo refuerza ante cualquier ruta
-- de escritura (por ejemplo, un admin con UPDATE directo).
alter table public.profiles
  add constraint profiles_username_format_check
    check (username is null or username ~ '^[a-z0-9_.]{3,30}$'),
  add constraint profiles_bio_len_check
    check (bio is null or char_length(bio) <= 280);
create unique index profiles_username_uidx on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- profiles: UPDATE del propio perfil, solo dentro de update_my_profile
-- ---------------------------------------------------------------------------
-- La marca la pone la funcion con `set_config(..., true)` (vive solo en la transaccion) y PostgREST no
-- expone `set_config`. El `with check` compara las columnas privilegiadas con las actuales (la
-- subconsulta ve la fila anterior); `is not distinct from` porque las rutas pueden ser nulas.
create policy profiles_update_self on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    and public.auth_role() is not null
    and coalesce(current_setting('vexa.profile_self_rpc', true), '') = '1'
  )
  with check (
    id = (select auth.uid())
    and public.auth_role() is not null
    and coalesce(current_setting('vexa.profile_self_rpc', true), '') = '1'
    and (role, area, weekly_hours, active, avatar_path, banner_path) is not distinct from (
      select row(p.role, p.area, p.weekly_hours, p.active, p.avatar_path, p.banner_path)
      from public.profiles p where p.id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: guarda nombre, usuario y bio de quien llama
-- ---------------------------------------------------------------------------
-- Reemplaza los tres campos. Usuario o bio vacios se guardan como nulos. El usuario se normaliza a
-- minusculas; si ya lo tiene otra persona, el indice unico responde con 23505.
create function public.update_my_profile(
  p_name text,
  p_username text default null,
  p_bio text default null
) returns public.profiles
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_username text := nullif(lower(btrim(coalesce(p_username, ''))), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'Inicia sesion para continuar' using errcode = '42501';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'El nombre debe tener de 1 a 80 caracteres' using errcode = '23514';
  end if;
  if v_username is not null and v_username !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'El usuario debe tener de 3 a 30 caracteres: letras, numeros, punto o guion bajo'
      using errcode = '23514';
  end if;
  if v_bio is not null and char_length(v_bio) > 280 then
    raise exception 'La biografia puede tener hasta 280 caracteres' using errcode = '23514';
  end if;

  perform set_config('vexa.profile_self_rpc', '1', true);
  update public.profiles set name = v_name, username = v_username, bio = v_bio
  where id = v_uid
  returning * into v_row;
  -- FOUND se lee antes de `perform`, que lo sobrescribe.
  if not found then
    raise exception 'Inicia sesion para continuar' using errcode = '42501';
  end if;
  perform set_config('vexa.profile_self_rpc', '', true);
  return v_row;
end;
$$;

revoke execute on function public.update_my_profile(text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- notification_preferences: una fila por persona; sin fila = todo activado
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id),
  task_assigned boolean not null default true,
  -- Guardadas, sin efecto todavia: no hay recordatorio ni resumen por reloj (diferidos).
  hours_reminder boolean not null default true,
  weekly_summary boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

revoke all on public.notification_preferences from public, anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id, task_assigned, hours_reminder, weekly_summary)
  on public.notification_preferences to authenticated;
grant update (task_assigned, hours_reminder, weekly_summary)
  on public.notification_preferences to authenticated;

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and public.auth_role() is not null);
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.auth_role() is not null);
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()) and public.auth_role() is not null)
  with check (user_id = (select auth.uid()) and public.auth_role() is not null);

-- RPC: cambia solo las preferencias indicadas (nulo = no tocar). SECURITY INVOKER: usa los
-- privilegios de columna y las politicas de arriba. Crea la fila si aun no existe.
create function public.set_notification_preferences(
  p_task_assigned boolean default null,
  p_hours_reminder boolean default null,
  p_weekly_summary boolean default null
) returns public.notification_preferences
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.notification_preferences;
begin
  if v_uid is null then
    raise exception 'Inicia sesion para continuar' using errcode = '42501';
  end if;
  insert into public.notification_preferences as np (user_id, task_assigned, hours_reminder, weekly_summary)
  values (v_uid, coalesce(p_task_assigned, true), coalesce(p_hours_reminder, true),
    coalesce(p_weekly_summary, true))
  on conflict (user_id) do update set
    task_assigned = coalesce(p_task_assigned, np.task_assigned),
    hours_reminder = coalesce(p_hours_reminder, np.hours_reminder),
    weekly_summary = coalesce(p_weekly_summary, np.weekly_summary)
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.set_notification_preferences(boolean, boolean, boolean)
  from public, anon;
grant execute on function public.set_notification_preferences(boolean, boolean, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- task_assigned respeta la preferencia (sin fila = activado)
-- ---------------------------------------------------------------------------
create or replace function private.notify_task_assigned() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor public.profiles;
  v_recipient text;
  v_project text;
  v_title text := left(new.title, 120);
begin
  if new.assignee_id is null or new.assignee_id is not distinct from v_uid then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return null;
  end if;
  if not coalesce((
    select np.task_assigned from public.notification_preferences np
    where np.user_id = new.assignee_id
  ), true) then
    return null;
  end if;
  select * into v_actor from public.profiles p where p.id = v_uid;
  select p.name into v_recipient from public.profiles p where p.id = new.assignee_id;
  select left(pr.name, 120) into v_project from public.projects pr where pr.id = new.project_id;

  perform private.notify(new.assignee_id, 'task_assigned', jsonb_strip_nulls(jsonb_build_object(
    'title', 'Tienes una nueva tarea asignada',
    'message', case when v_actor.id is null then 'Te asignaron «' || v_title || '».'
      else left(v_actor.name, 120) || ' te asignó «' || v_title || '».' end,
    'actorName', left(v_actor.name, 120),
    'actorRole', private.notify_role_label(v_actor.role),
    'recipientName', left(v_recipient, 120),
    'projectName', v_project,
    'projectId', new.project_id::text,
    'taskName', left(new.title, 200),
    'taskId', new.id::text,
    'details', 'Revisa los requisitos, identifica dudas y prepara tus observaciones antes de comenzar el trabajo.',
    'nextStep', 'Ve a Mis tareas para consultar tus asignaciones.'
  )));
  return null;
end;
$$;
