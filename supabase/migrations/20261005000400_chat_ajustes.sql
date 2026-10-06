-- C30: ajustes, estado publico, fondo y presencia del chat (B5c).
--
-- Reproduce las reglas 9 y 10 del chat actual (`chat-store.ts`: `patchChatSettings`).
--
--   * `chat_status` es PUBLICA para el estudio: el estado, la presencia y el proyecto actual se ven en
--     la lista de conversaciones y en el panel de perfil. Cualquier miembro activo lee todas las
--     filas; cada persona escribe solo la suya. `presence = false` oculta a la persona (la presencia
--     en vivo usa Realtime Presence, que no necesita tabla).
--   * `chat_preferences` es PRIVADA: avisos, sonido y fondo. Solo la dueña la lee y la escribe; ni el
--     admin. No se publica en Realtime.
--   * Sin fila no hay datos: el adaptador aplica los valores por defecto, que son los de las columnas
--     (estado "Disponible", avisos si, sonido suave, presencia si, fondo ninguno, proyecto ninguno).
--   * Los valores se normalizan en triggers guarda (no se rechazan), como el mock: el estado se
--     recorta y se corta a 80 caracteres y un fondo invalido pasa a `{"kind":"none"}`.
--   * Los bytes del fondo viven en el bucket privado `chat-wallpapers`, carpeta `<user_id>/`.
--   * Los ajustes NO se auditan. Las guardas son SECURITY INVOKER (sin ayudantes nuevos de permisos).

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create type public.chat_sound as enum ('soft', 'bell', 'none');

create table public.chat_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'Disponible' constraint chat_status_status_len_check check (char_length(status) <= 80),
  presence boolean not null default true,
  current_project_id uuid references public.projects (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger chat_status_updated_at before update on public.chat_status
  for each row execute function private.set_updated_at();

create table public.chat_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  notifications boolean not null default true,
  sound public.chat_sound not null default 'soft',
  -- `{"kind":"none"}`, `{"kind":"preset","id":<texto>}` o `{"kind":"image"}` (los bytes van aparte).
  wallpaper jsonb not null default '{"kind":"none"}'::jsonb,
  wallpaper_path text,
  updated_at timestamptz not null default now(),
  constraint chat_preferences_wallpaper_path_owner_check
    check (wallpaper_path is null or left(wallpaper_path, 37) = user_id::text || '/')
);
create trigger chat_preferences_updated_at before update on public.chat_preferences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guardas (normalizan en vez de rechazar, salvo proyecto y ruta)
-- ---------------------------------------------------------------------------
create function private.chat_status_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.status := left(btrim(coalesce(new.status, 'Disponible'), E' \t\r\n'), 80);
  -- Solo se valida al elegir un proyecto nuevo: perder el acceso despues no bloquea otros cambios.
  -- Sin sesion (mantenimiento con rol de base de datos) no hay a quien comprobar.
  if new.current_project_id is not null
     and (tg_op = 'INSERT' or new.current_project_id is distinct from old.current_project_id)
     and (select auth.uid()) is not null
     and not public.can_access_project(new.current_project_id) then
    raise exception 'No tienes acceso a ese proyecto.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.chat_status_guard() from public, anon, authenticated;
create trigger chat_status_guard before insert or update on public.chat_status
  for each row execute function private.chat_status_guard();

create function private.chat_preferences_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v jsonb := new.wallpaper;
begin
  if v is not null and jsonb_typeof(v) = 'object' then
    if v ->> 'kind' = 'preset' and jsonb_typeof(v -> 'id') = 'string'
       and char_length(v ->> 'id') between 1 and 40 then
      new.wallpaper := jsonb_build_object('kind', 'preset', 'id', v ->> 'id');
    elsif v ->> 'kind' = 'image' and new.wallpaper_path is not null then
      new.wallpaper := '{"kind":"image"}'::jsonb;
    else
      new.wallpaper := '{"kind":"none"}'::jsonb;
    end if;
  else
    new.wallpaper := '{"kind":"none"}'::jsonb;
  end if;

  if new.wallpaper_path is not null
     and (tg_op = 'INSERT' or new.wallpaper_path is distinct from old.wallpaper_path) then
    if left(new.wallpaper_path, 37) is distinct from new.user_id::text || '/' then
      raise exception 'La imagen debe estar en tu carpeta' using errcode = '42501';
    end if;
    -- Se comprueba bajo RLS de quien llama: solo ve los objetos de su propia carpeta.
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'chat-wallpapers' and o.name = new.wallpaper_path) then
      raise exception 'La imagen no existe en el almacenamiento' using errcode = 'P0002';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.chat_preferences_guard() from public, anon, authenticated;
create trigger chat_preferences_guard before insert or update on public.chat_preferences
  for each row execute function private.chat_preferences_guard();

-- ---------------------------------------------------------------------------
-- Privilegios y RLS
-- ---------------------------------------------------------------------------
revoke all on public.chat_status, public.chat_preferences from public, anon, authenticated;
grant select on public.chat_status, public.chat_preferences to authenticated;
grant insert (user_id, status, presence, current_project_id), update (status, presence, current_project_id)
  on public.chat_status to authenticated;
grant insert (user_id, notifications, sound, wallpaper, wallpaper_path),
  update (notifications, sound, wallpaper, wallpaper_path) on public.chat_preferences to authenticated;

alter table public.chat_status enable row level security;
alter table public.chat_preferences enable row level security;

create policy chat_status_select on public.chat_status for select to authenticated
  using (public.auth_role() is not null);
create policy chat_status_insert_own on public.chat_status for insert to authenticated
  with check (user_id = (select auth.uid()) and public.auth_role() is not null);
create policy chat_status_update_own on public.chat_status for update to authenticated
  using (user_id = (select auth.uid()) and public.auth_role() is not null)
  with check (user_id = (select auth.uid()) and public.auth_role() is not null);

create policy chat_preferences_select_own on public.chat_preferences for select to authenticated
  using (user_id = (select auth.uid()) and public.auth_role() is not null);
create policy chat_preferences_insert_own on public.chat_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and public.auth_role() is not null);
create policy chat_preferences_update_own on public.chat_preferences for update to authenticated
  using (user_id = (select auth.uid()) and public.auth_role() is not null)
  with check (user_id = (select auth.uid()) and public.auth_role() is not null);

-- ---------------------------------------------------------------------------
-- Storage: fondos de pantalla (bucket privado, solo la carpeta propia)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-wallpapers', 'chat-wallpapers', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura, subida, cambio y baja: solo en la carpeta propia (`<uid>/`) y con el perfil activo.
create policy chat_wallpapers_select_own on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-wallpapers' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy chat_wallpapers_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-wallpapers' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy chat_wallpapers_update_own on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-wallpapers' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'chat-wallpapers' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy chat_wallpapers_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-wallpapers' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Realtime: el estado y la presencia deben llegar en vivo; las preferencias NO se publican.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_status'
     ) then
    alter publication supabase_realtime add table public.chat_status;
  end if;
end;
$$;
