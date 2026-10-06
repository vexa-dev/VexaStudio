-- C27: fotos y banners de perfil en Storage (B3).
--
-- Dos buckets privados (`avatars`, `banners`; 2 MiB; solo webp/jpeg/png). Cada persona escribe en
-- su propia carpeta (`<user_id>/<archivo>`), cualquier miembro activo del estudio lee. La ruta del
-- objeto vive en `profiles.avatar_path` / `profiles.banner_path` y el cliente la muestra con URLs
-- firmadas de vida corta. Los limites de tamano y MIME los aplica la API de Storage.
--
-- La ruta se guarda solo con `public.set_profile_media`. Es SECURITY INVOKER a proposito: el barrido
-- final (06) admite como SECURITY DEFINER publicas solo los ayudantes de permisos. Para que pueda
-- actualizar el perfil propio sin abrir un UPDATE general, la politica `profiles_update_media_own`
-- solo se cumple dentro de esa funcion (marca de transaccion `vexa.profile_media_rpc`) y, aun con la
-- marca, exige que el resto de columnas queden como estaban.

-- ---------------------------------------------------------------------------
-- Columnas: la ruta debe empezar por la carpeta del dueno
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column avatar_path text,
  add column banner_path text;

alter table public.profiles
  add constraint profiles_avatar_path_owner_check
    check (avatar_path is null or left(avatar_path, 37) = id::text || '/'),
  add constraint profiles_banner_path_owner_check
    check (banner_path is null or left(banner_path, 37) = id::text || '/');

-- ---------------------------------------------------------------------------
-- Storage: buckets privados
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('banners', 'banners', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: cualquier usuario activo. Escritura, cambio y baja: solo en la carpeta propia y con el
-- perfil activo. (El reemplazo de una foto sube un objeto nuevo y retira el anterior.)
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.auth_role() is not null);
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy avatars_update_own on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy banners_select on storage.objects for select to authenticated
  using (bucket_id = 'banners' and public.auth_role() is not null);
create policy banners_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'banners' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy banners_update_own on storage.objects for update to authenticated
  using (
    bucket_id = 'banners' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'banners' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy banners_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'banners' and public.auth_role() is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- profiles: UPDATE del propio perfil, solo dentro de set_profile_media
-- ---------------------------------------------------------------------------
-- La marca la pone la funcion con `set_config(..., true)` (vive solo en la transaccion). PostgREST
-- no expone `set_config`, asi que el cliente no puede fijarla. Aun con la marca, el `with check`
-- compara el resto de columnas con las actuales (la subconsulta ve la fila anterior).
create policy profiles_update_media_own on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    and coalesce(current_setting('vexa.profile_media_rpc', true), '') = '1'
  )
  with check (
    id = (select auth.uid())
    and coalesce(current_setting('vexa.profile_media_rpc', true), '') = '1'
    and (name, role, area, weekly_hours, active) = (
      select p.name, p.role, p.area, p.weekly_hours, p.active
      from public.profiles p where p.id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: guarda o quita la foto y el banner de quien llama
-- ---------------------------------------------------------------------------
-- Solo toca las columnas pedidas. Una ruta debe estar en la carpeta propia y el objeto debe existir
-- en el bucket de su tipo (se comprueba bajo RLS: un miembro activo ve los objetos del estudio).
create function public.set_profile_media(
  p_avatar_path text default null,
  p_banner_path text default null,
  p_clear_avatar boolean default false,
  p_clear_banner boolean default false
) returns public.profiles
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'Inicia sesion para continuar' using errcode = '42501';
  end if;
  if (p_avatar_path is not null and p_clear_avatar)
     or (p_banner_path is not null and p_clear_banner) then
    raise exception 'Operacion de imagen no valida' using errcode = '22023';
  end if;
  if p_avatar_path is not null then
    if (storage.foldername(p_avatar_path))[1] is distinct from v_uid::text then
      raise exception 'La imagen debe estar en tu carpeta' using errcode = '42501';
    end if;
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'avatars' and o.name = p_avatar_path) then
      raise exception 'La imagen no existe en el almacenamiento' using errcode = 'P0002';
    end if;
  end if;
  if p_banner_path is not null then
    if (storage.foldername(p_banner_path))[1] is distinct from v_uid::text then
      raise exception 'La imagen debe estar en tu carpeta' using errcode = '42501';
    end if;
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'banners' and o.name = p_banner_path) then
      raise exception 'La imagen no existe en el almacenamiento' using errcode = 'P0002';
    end if;
  end if;

  perform set_config('vexa.profile_media_rpc', '1', true);
  update public.profiles set
    avatar_path = case when p_clear_avatar then null else coalesce(p_avatar_path, avatar_path) end,
    banner_path = case when p_clear_banner then null else coalesce(p_banner_path, banner_path) end
  where id = v_uid
  returning * into v_row;
  -- FOUND se lee antes de `perform`, que lo sobrescribe.
  if not found then
    raise exception 'Inicia sesion para continuar' using errcode = '42501';
  end if;
  perform set_config('vexa.profile_media_rpc', '', true);
  return v_row;
end;
$$;

revoke execute on function public.set_profile_media(text, text, boolean, boolean) from public, anon;
grant execute on function public.set_profile_media(text, text, boolean, boolean) to authenticated;
