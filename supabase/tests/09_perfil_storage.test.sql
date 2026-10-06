-- C27: fotos y banners de perfil en Storage: buckets privados, politicas por carpeta propia y
-- RPC set_profile_media. Los limites de tamano y MIME los aplica la API de Storage; aqui solo se
-- verifica la configuracion del bucket. Ids del seed: 2 Rober (socio), 4 Diego (socio), 5 Alex.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

create function pg_temp.uid(p_name text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000000' || case p_name
    when 'jhony' then '1' when 'rober' then '2' when 'jose' then '3'
    when 'diego' then '4' when 'alex' then '5' end)::uuid $$;
create function pg_temp.as_user(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', pg_temp.uid(p_name), 'role', 'authenticated', 'session_id', 's-' || p_name)::text, true);
  set local role authenticated;
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end $$;
create function pg_temp.as_system() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Filas afectadas por una DML con el rol actual.
create function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;
-- Filas visibles en storage.objects del bucket; -1 si el rol ni siquiera puede consultar.
create function pg_temp.visible(p_bucket text) returns int language plpgsql as $$
declare n int;
begin
  select count(*)::int into n from storage.objects where bucket_id = p_bucket;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;
grant execute on all functions in schema pg_temp to public;

-- ---------------------------------------------------------------- columnas
select pg_temp.as_system();
select has_column('public', 'profiles', 'avatar_path', 'profiles tiene avatar_path');
select has_column('public', 'profiles', 'banner_path', 'profiles tiene banner_path');

-- ---------------------------------------------------------------- buckets
select is((select public from storage.buckets where id = 'avatars'), false, 'avatars es privado');
select is((select public from storage.buckets where id = 'banners'), false, 'banners es privado');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 2097152::bigint,
  'avatars limita a 2 MiB');
select is((select file_size_limit from storage.buckets where id = 'banners'), 2097152::bigint,
  'banners limita a 2 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'avatars'),
  array['image/webp', 'image/jpeg', 'image/png'], 'avatars solo admite webp, jpeg y png');
select is((select allowed_mime_types from storage.buckets where id = 'banners'),
  array['image/webp', 'image/jpeg', 'image/png'], 'banners solo admite webp, jpeg y png');

-- ---------------------------------------------------------------- politicas (catalogo)
select is((select string_agg(policyname, ',' order by policyname) from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars\_%'),
  'avatars_delete_own,avatars_insert_own,avatars_select,avatars_update_own',
  'avatars: lectura, subida, cambio y baja propias');
select is((select string_agg(policyname, ',' order by policyname) from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'banners\_%'),
  'banners_delete_own,banners_insert_own,banners_select,banners_update_own',
  'banners: lectura, subida, cambio y baja propias');

-- ---------------------------------------------------------------- subida a la carpeta propia
select pg_temp.as_user('rober');
select lives_ok(
  format($$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, auth.uid())$$,
    pg_temp.uid('rober') || '/avatar-1.webp'),
  'rober sube su foto a su carpeta');
select lives_ok(
  format($$insert into storage.objects (bucket_id, name, owner) values ('banners', %L, auth.uid())$$,
    pg_temp.uid('rober') || '/banner-1.webp'),
  'rober sube su banner a su carpeta');
select throws_like(
  format($$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, auth.uid())$$,
    pg_temp.uid('alex') || '/avatar-x.webp'),
  'new row violates row-level security%', 'rober no sube a la carpeta de alex');
select throws_like(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', 'suelto.webp', auth.uid())$$,
  'new row violates row-level security%', 'no se sube fuera de una carpeta propia');

-- ---------------------------------------------------------------- lectura
select pg_temp.as_user('alex');
select is(pg_temp.visible('avatars'), 1, 'cualquier miembro del estudio lee las fotos');
select is(pg_temp.visible('banners'), 1, 'cualquier miembro del estudio lee los banners');
select pg_temp.as_anon();
select ok(pg_temp.visible('avatars') in (-1, 0), 'anon no lee fotos');
select pg_temp.as_system();
update public.profiles set active = false where id = pg_temp.uid('diego');
select pg_temp.as_user('diego');
select is(pg_temp.visible('avatars'), 0, 'un perfil inactivo no lee fotos');
select throws_like(
  format($$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, auth.uid())$$,
    pg_temp.uid('diego') || '/avatar-1.webp'),
  'new row violates row-level security%', 'un perfil inactivo no sube fotos');

-- ---------------------------------------------------------------- cambio y baja
select pg_temp.as_user('alex');
select is(pg_temp.affected($$update storage.objects set name = name where bucket_id = 'avatars'$$), 0,
  'alex no modifica la foto de rober');
-- Storage bloquea el DELETE directo (protect_delete): la baja solo pasa por su API, asi que aqui
-- se verifica que la politica de baja existe y esta atada a la carpeta propia.
select ok((select bool_and(cmd = 'DELETE' and qual like '%foldername%auth.uid()%')
  from pg_policies where schemaname = 'storage' and policyname in ('avatars_delete_own', 'banners_delete_own')),
  'la baja de fotos y banners queda atada a la carpeta propia');
select pg_temp.as_user('rober');
select is(pg_temp.affected($$update storage.objects set name = name where bucket_id = 'banners'$$), 1,
  'rober modifica su propio banner');

-- ---------------------------------------------------------------- RPC set_profile_media
select is(
  (select avatar_path from public.set_profile_media(p_avatar_path => pg_temp.uid('rober') || '/avatar-1.webp')),
  pg_temp.uid('rober') || '/avatar-1.webp', 'rober guarda su foto');
select pg_temp.as_user('alex');
select is((select avatar_path from public.profiles where id = pg_temp.uid('rober')),
  pg_temp.uid('rober') || '/avatar-1.webp', 'los demas ven la ruta de la foto de rober');
select pg_temp.as_user('rober');
select is(
  (select banner_path from public.set_profile_media(p_banner_path => pg_temp.uid('rober') || '/banner-1.webp')),
  pg_temp.uid('rober') || '/banner-1.webp', 'rober guarda su banner');
select is((select avatar_path from public.profiles where id = pg_temp.uid('rober')),
  pg_temp.uid('rober') || '/avatar-1.webp', 'guardar el banner no toca la foto');
select throws_ok(
  format($$select public.set_profile_media(p_avatar_path => %L)$$, pg_temp.uid('alex') || '/avatar-1.webp'),
  null, 'La imagen debe estar en tu carpeta', 'rechaza una ruta fuera de tu carpeta');
select throws_ok(
  format($$select public.set_profile_media(p_avatar_path => %L)$$, pg_temp.uid('rober') || '/no-existe.webp'),
  null, 'La imagen no existe en el almacenamiento', 'rechaza una ruta sin objeto');
select throws_ok(
  format($$select public.set_profile_media(p_banner_path => %L)$$, pg_temp.uid('rober') || '/avatar-1.webp'),
  null, 'La imagen no existe en el almacenamiento', 'el objeto debe estar en el bucket de su tipo');
select throws_ok(
  format($$select public.set_profile_media(p_avatar_path => %L, p_clear_avatar => true)$$,
    pg_temp.uid('rober') || '/avatar-1.webp'),
  null, 'Operacion de imagen no valida', 'no se guarda y se quita a la vez');
select is((select avatar_path from public.set_profile_media(p_clear_avatar => true)), null,
  'null quita la foto');
select is((select banner_path from public.profiles where id = pg_temp.uid('rober')),
  pg_temp.uid('rober') || '/banner-1.webp', 'quitar la foto no toca el banner');

-- ---------------------------------------------------------------- nadie toca la fila de otro
select pg_temp.as_user('alex');
select throws_ok(
  format($$select public.set_profile_media(p_avatar_path => %L)$$, pg_temp.uid('rober') || '/avatar-1.webp'),
  null, 'La imagen debe estar en tu carpeta', 'alex no apunta a la carpeta de rober');
select is((select banner_path from public.profiles where id = pg_temp.uid('rober')),
  pg_temp.uid('rober') || '/banner-1.webp', 'la fila de rober sigue igual');
select is(pg_temp.affected($$update public.profiles set avatar_path = null where id = pg_temp.uid('alex')$$), 0,
  'sin la RPC no hay UPDATE directo sobre el propio perfil');
-- Defensa en profundidad: aun con la marca de la RPC puesta a mano, solo cambian las columnas de media.
select set_config('vexa.profile_media_rpc', '1', true);
select throws_like($$update public.profiles set role = 'admin' where id = pg_temp.uid('alex')$$,
  'new row violates row-level security%', 'con la marca, alex tampoco se promueve');
select is(pg_temp.affected($$update public.profiles set avatar_path = null where id = pg_temp.uid('rober')$$), 0,
  'con la marca, alex tampoco toca el perfil de rober');

-- ---------------------------------------------------------------- restriccion en la base
select pg_temp.as_system();
select throws_ok(
  format($$update public.profiles set avatar_path = %L where id = pg_temp.uid('rober')$$,
    pg_temp.uid('alex') || '/avatar-1.webp'),
  '23514', null, 'la base exige que la ruta empiece por la carpeta del dueno');

-- ---------------------------------------------------------------- actividad y privilegios
select is((select count(*)::int from public.audit_log
  where event_type = 'member.updated' and entity_id = pg_temp.uid('rober')::text), 3,
  'guardar foto, guardar banner y quitar foto quedan en el registro como member.updated');
select is(public.verify_audit_chain(), null::bigint, 'la cadena sigue integra');
select ok(not has_function_privilege('anon',
  'public.set_profile_media(text, text, boolean, boolean)', 'execute'), 'anon no ejecuta la RPC');
select ok(has_function_privilege('authenticated',
  'public.set_profile_media(text, text, boolean, boolean)', 'execute'), 'authenticated ejecuta la RPC');

select * from finish();
rollback;
