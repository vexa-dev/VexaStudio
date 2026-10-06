-- C30: ajustes, estado publico, fondo y presencia del chat (B5c). Fija las reglas 9 y 10 del plan.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador, solo en el
-- proyecto 1). Proyectos: 1 Vexa Studio, 2 Fivuza, 3 Vantage.
begin;
create extension if not exists pgtap with schema extensions;
select plan(114);

create function pg_temp.uid(p_name text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000000' || case p_name
    when 'jhony' then '1' when 'rober' then '2' when 'jose' then '3'
    when 'diego' then '4' when 'alex' then '5' end)::uuid $$;
create function pg_temp.pid(p_n int) returns uuid language sql immutable as $$
  select ('10000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid $$;
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
-- Cambian una columna de la fila de quien llama y devuelven el valor que quedo guardado.
create function pg_temp.set_status(p text) returns text language plpgsql as $$
declare r text;
begin
  update public.chat_status set status = p where user_id = auth.uid() returning status into r;
  return r;
end $$;
create function pg_temp.set_wp(p text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  update public.chat_preferences set wallpaper = p::jsonb where user_id = auth.uid() returning wallpaper into r;
  return r;
end $$;
grant execute on all functions in schema pg_temp to public;

-- ================================================================ estructura
select pg_temp.as_system();
select has_table('public', 'chat_status', 'existe chat_status');
select has_table('public', 'chat_preferences', 'existe chat_preferences');
select enum_has_labels('public', 'chat_sound', array['soft', 'bell', 'none'], 'el tipo de sonido');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('chat_status', 'chat_preferences') and c.relrowsecurity), 2,
  'las dos tablas tienen RLS');
select is((select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname in ('chat_status', 'chat_preferences') and t.tgname like 'audit%' and not t.tgisinternal), 0,
  'los ajustes no se auditan');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'chat_status'), 1,
  'Realtime publica chat_status (estado y presencia llegan en vivo)');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'chat_preferences'), 0,
  'Realtime NO publica chat_preferences (es privada)');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('chat_status', 'chat_preferences')
    and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))), 0,
  'anon no tiene acceso a las tablas de ajustes');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('chat_status', 'chat_preferences')
    and (has_table_privilege('authenticated', c.oid, 'delete') or has_table_privilege('authenticated', c.oid, 'truncate'))), 0,
  'nadie borra ni vacia las tablas de ajustes');
select is((select confdeltype::text from pg_constraint
  where conrelid = 'public.chat_status'::regclass and contype = 'f' and confrelid = 'public.projects'::regclass),
  'n', 'al borrar un proyecto, el estado que lo apuntaba queda sin proyecto');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.chat_preferences'::regclass
  and contype = 'c' and conname = 'chat_preferences_wallpaper_path_owner_check'),
  'la ruta del fondo debe empezar por la carpeta del dueno (restriccion)');

-- ================================================================ bucket
select is((select public from storage.buckets where id = 'chat-wallpapers'), false, 'chat-wallpapers es privado');
select is((select file_size_limit from storage.buckets where id = 'chat-wallpapers'), 1048576::bigint,
  'chat-wallpapers limita a 1 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'chat-wallpapers'),
  array['image/webp', 'image/jpeg', 'image/png'], 'chat-wallpapers solo admite webp, jpeg y png');
select is((select string_agg(policyname, ',' order by policyname) from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'chat\_wallpapers\_%'),
  'chat_wallpapers_delete_own,chat_wallpapers_insert_own,chat_wallpapers_select_own,chat_wallpapers_update_own',
  'chat-wallpapers: lectura, subida, cambio y baja propias');
select ok((select bool_and(coalesce(qual, with_check) like '%foldername%auth.uid()%'
    and coalesce(qual, with_check) like '%auth_role()%' and coalesce(qual, with_check) like '%chat-wallpapers%')
  from pg_policies where schemaname = 'storage' and policyname like 'chat\_wallpapers\_%'),
  'las cuatro politicas del fondo exigen carpeta propia, perfil activo y su bucket');
select is((select string_agg(cmd, ',' order by cmd) from pg_policies
  where schemaname = 'storage' and policyname like 'chat\_wallpapers\_%'), 'DELETE,INSERT,SELECT,UPDATE',
  'una politica por operacion');
select ok((select bool_and(roles = '{authenticated}') from pg_policies
  where schemaname = 'storage' and policyname like 'chat\_wallpapers\_%'), 'las politicas son solo de authenticated');

-- ================================================================ 9a: valores por defecto
select pg_temp.as_user('rober');
select lives_ok(format($$insert into public.chat_status (user_id) values (%L)$$, pg_temp.uid('rober')),
  'rober crea su estado solo con su id');
select is((select (status, presence, current_project_id)::text from public.chat_status
  where user_id = pg_temp.uid('rober')), '(Disponible,t,)',
  '9a: estado "Disponible", presencia activada, sin proyecto');
select pg_temp.as_user('alex');
select lives_ok(format($$insert into public.chat_preferences (user_id) values (%L)$$, pg_temp.uid('alex')),
  'alex crea sus preferencias solo con su id');
select is((select (notifications, sound)::text from public.chat_preferences where user_id = pg_temp.uid('alex')),
  '(t,soft)', '9a: avisos activados y sonido suave');
select is((select wallpaper from public.chat_preferences where user_id = pg_temp.uid('alex')),
  '{"kind":"none"}'::jsonb, '9a: fondo ninguno');
select is((select wallpaper_path from public.chat_preferences where user_id = pg_temp.uid('alex')), null,
  '9a: sin imagen de fondo');
select pg_temp.as_user('jose');
select is((select count(*)::int from public.chat_preferences), 0, '9a: sin fila no hay datos (el adaptador pone los valores por defecto)');

-- ================================================================ 9b: un parche conserva el resto
select pg_temp.as_user('rober');
select lives_ok(format($$update public.chat_status set presence = false, current_project_id = %L
  where user_id = auth.uid()$$, pg_temp.pid(2)), 'rober apaga su presencia y elige Fivuza');
select lives_ok($$update public.chat_status set status = 'En reunion' where user_id = auth.uid()$$,
  'rober cambia solo el estado');
select is((select (status, presence, current_project_id)::text from public.chat_status
  where user_id = pg_temp.uid('rober')), format('("En reunion",f,%s)', pg_temp.pid(2)),
  '9b: cambiar el estado conserva presencia y proyecto');
select pg_temp.as_user('alex');
select lives_ok($$update public.chat_preferences set sound = 'bell' where user_id = auth.uid()$$, 'alex elige otro sonido');
select lives_ok($$update public.chat_preferences set notifications = false where user_id = auth.uid()$$, 'alex apaga los avisos');
select is((select (notifications, sound)::text from public.chat_preferences where user_id = pg_temp.uid('alex')),
  '(f,bell)', '9b: apagar los avisos conserva el sonido');
select lives_ok($$update public.chat_preferences set sound = 'none' where user_id = auth.uid()$$, 'el sonido admite "ninguno"');
select throws_ok($$update public.chat_preferences set sound = 'fuerte' where user_id = auth.uid()$$,
  '22P02', null, 'un sonido desconocido se rechaza');

-- ================================================================ 9c: estado recortado a 80
select pg_temp.as_user('rober');
select is(pg_temp.set_status('   Trabajando   '), 'Trabajando', '9c: el estado se recorta de espacios');
select is(pg_temp.set_status(repeat('x', 100)), repeat('x', 80), '9c: el estado se corta a 80 caracteres (no se rechaza)');
select is(pg_temp.set_status(repeat('x', 80)), repeat('x', 80), '9c: 80 caracteres exactos se conservan');
select is(pg_temp.set_status(repeat('á', 100)), repeat('á', 80), '9c: se cuentan caracteres, no bytes');
select is(pg_temp.set_status('  ' || repeat('y', 90)), repeat('y', 80), '9c: primero recorta espacios y luego corta');
select is(pg_temp.set_status(''), '', '9c: el estado vacio se permite (como el mock)');
select is(pg_temp.set_status('     '), '', '9c: solo espacios queda vacio');
select is(pg_temp.set_status(null), 'Disponible', '9c: un estado nulo vuelve al valor por defecto');
select pg_temp.as_user('jose');
select lives_ok(format($$insert into public.chat_status (user_id, status) values (%L, %L)$$,
  pg_temp.uid('jose'), repeat('z', 120)), 'jose crea su estado con un texto largo');
select is((select char_length(status) from public.chat_status where user_id = pg_temp.uid('jose')), 80,
  '9c: tambien al crear se corta a 80');

-- ================================================================ 9d: fondo normalizado
select pg_temp.as_user('alex');
select is(pg_temp.set_wp('{"kind":"preset","id":"grid"}'), '{"kind":"preset","id":"grid"}'::jsonb, '9d: un preset valido se conserva');
select is(pg_temp.set_wp('{"kind":"preset","id":"grid","extra":1,"x":[1]}'), '{"kind":"preset","id":"grid"}'::jsonb,
  '9d: se descartan los campos de mas');
select is(pg_temp.set_wp('{"kind":"none","id":"grid"}'), '{"kind":"none"}'::jsonb, '9d: "ninguno" no lleva id');
select is(pg_temp.set_wp('{"kind":"weird"}'), '{"kind":"none"}'::jsonb, '9d: un tipo desconocido pasa a ninguno');
select is(pg_temp.set_wp('{"kind":"preset"}'), '{"kind":"none"}'::jsonb, '9d: un preset sin id pasa a ninguno');
select is(pg_temp.set_wp('{"kind":"preset","id":""}'), '{"kind":"none"}'::jsonb, '9d: un preset con id vacio pasa a ninguno');
select is(pg_temp.set_wp('{"kind":"preset","id":5}'), '{"kind":"none"}'::jsonb, '9d: un id que no es texto pasa a ninguno');
select is(pg_temp.set_wp(format('{"kind":"preset","id":"%s"}', repeat('a', 40))),
  jsonb_build_object('kind', 'preset', 'id', repeat('a', 40)), '9d: un id de 40 caracteres se conserva');
select is(pg_temp.set_wp(format('{"kind":"preset","id":"%s"}', repeat('a', 41))), '{"kind":"none"}'::jsonb,
  '9d: un id de 41 caracteres pasa a ninguno');
select is(pg_temp.set_wp('"texto"'), '{"kind":"none"}'::jsonb, '9d: un texto suelto pasa a ninguno');
select is(pg_temp.set_wp('[]'), '{"kind":"none"}'::jsonb, '9d: una lista pasa a ninguno');
select is(pg_temp.set_wp('null'), '{"kind":"none"}'::jsonb, '9d: el null de JSON pasa a ninguno');
select is(pg_temp.set_wp(null), '{"kind":"none"}'::jsonb, '9d: un valor nulo pasa a ninguno');
select is(pg_temp.set_wp('{"kind":"image"}'), '{"kind":"none"}'::jsonb, '9d: "imagen" sin ruta guardada pasa a ninguno');

-- ================================================================ fondo con imagen (bucket y ruta)
select lives_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('chat-wallpapers', %L, auth.uid())$$,
  pg_temp.uid('alex') || '/fondo-1.webp'), 'alex sube su fondo a su carpeta');
select throws_like(format($$insert into storage.objects (bucket_id, name, owner) values ('chat-wallpapers', %L, auth.uid())$$,
  pg_temp.uid('rober') || '/fondo-x.webp'), 'new row violates row-level security%', 'alex no sube a la carpeta de rober');
select throws_like($$insert into storage.objects (bucket_id, name, owner) values ('chat-wallpapers', 'suelto.webp', auth.uid())$$,
  'new row violates row-level security%', 'no se sube fuera de una carpeta propia');
select lives_ok(format($$update public.chat_preferences set wallpaper_path = %L, wallpaper = '{"kind":"image"}'
  where user_id = auth.uid()$$, pg_temp.uid('alex') || '/fondo-1.webp'), 'alex guarda la ruta y elige imagen');
select is((select wallpaper from public.chat_preferences where user_id = pg_temp.uid('alex')),
  '{"kind":"image"}'::jsonb, 'con ruta guardada, "imagen" se conserva');
select is(pg_temp.set_wp('{"kind":"preset","id":"lines"}'), '{"kind":"preset","id":"lines"}'::jsonb,
  'elegir un preset no borra la ruta de la imagen');
select is((select wallpaper_path from public.chat_preferences where user_id = pg_temp.uid('alex')),
  pg_temp.uid('alex') || '/fondo-1.webp', 'la ruta de la imagen sigue guardada');
select throws_ok(format($$update public.chat_preferences set wallpaper_path = %L where user_id = auth.uid()$$,
  pg_temp.uid('alex') || '/no-existe.webp'), null, 'La imagen no existe en el almacenamiento', 'rechaza una ruta sin objeto');
select throws_ok(format($$update public.chat_preferences set wallpaper_path = %L where user_id = auth.uid()$$,
  pg_temp.uid('rober') || '/fondo-1.webp'), null, 'La imagen debe estar en tu carpeta', 'rechaza una ruta de la carpeta de otra persona');
select throws_ok($$update public.chat_preferences set wallpaper_path = 'suelto.webp' where user_id = auth.uid()$$,
  null, 'La imagen debe estar en tu carpeta', 'rechaza una ruta fuera de una carpeta');
select lives_ok($$update public.chat_preferences set wallpaper = '{"kind":"image"}' where user_id = auth.uid()$$,
  'elegir imagen otra vez con la ruta guardada');
select lives_ok($$update public.chat_preferences set wallpaper_path = null where user_id = auth.uid()$$,
  'quitar la ruta de la imagen');
select is((select wallpaper from public.chat_preferences where user_id = pg_temp.uid('alex')),
  '{"kind":"none"}'::jsonb, 'sin ruta, el fondo "imagen" pasa a ninguno');

-- ================================================================ storage: lectura, cambio y baja
select is(pg_temp.visible('chat-wallpapers'), 1, 'alex lee su propio fondo');
select pg_temp.as_user('rober');
select is(pg_temp.visible('chat-wallpapers'), 0, 'rober no lee el fondo de alex');
select is(pg_temp.affected($$update storage.objects set name = name where bucket_id = 'chat-wallpapers'$$), 0,
  'rober no modifica el fondo de alex');
select pg_temp.as_user('jhony');
select is(pg_temp.visible('chat-wallpapers'), 0, 'ni siquiera el admin lee el fondo de otra persona');
select pg_temp.as_anon();
select ok(pg_temp.visible('chat-wallpapers') in (-1, 0), 'anon no lee fondos');
select pg_temp.as_user('alex');
select is(pg_temp.affected($$update storage.objects set name = name where bucket_id = 'chat-wallpapers'$$), 1,
  'alex modifica su propio fondo');
-- Storage bloquea el DELETE directo (protect_delete): la baja solo pasa por su API, asi que aqui
-- se verifica que la politica de baja existe y esta atada a la carpeta propia.
select ok((select cmd = 'DELETE' and qual like '%foldername%auth.uid()%' and qual like '%auth_role()%'
  from pg_policies where schemaname = 'storage' and policyname = 'chat_wallpapers_delete_own'),
  'la baja del fondo queda atada a la carpeta propia y al perfil activo');

-- ================================================================ 9e: proyecto actual
select pg_temp.as_user('alex');
select lives_ok(format($$insert into public.chat_status (user_id, current_project_id) values (%L, %L)$$,
  pg_temp.uid('alex'), pg_temp.pid(1)), 'alex crea su estado con el proyecto 1 (es integrante)');
select throws_ok(format($$update public.chat_status set current_project_id = %L where user_id = auth.uid()$$, pg_temp.pid(2)),
  '42501', 'No tienes acceso a ese proyecto.', '9e: alex no elige un proyecto al que no pertenece');
select throws_ok(format($$update public.chat_status set current_project_id = %L where user_id = auth.uid()$$,
  '99999999-0000-4000-8000-000000000000'::uuid), '42501', 'No tienes acceso a ese proyecto.',
  '9e: un proyecto inexistente se rechaza');
select is((select current_project_id from public.chat_status where user_id = pg_temp.uid('alex')), pg_temp.pid(1),
  '9e: el rechazo no cambia el proyecto anterior');
select lives_ok($$update public.chat_status set current_project_id = null where user_id = auth.uid()$$,
  '9e: el proyecto vacio significa ninguno');
select is((select current_project_id from public.chat_status where user_id = pg_temp.uid('alex')), null, '9e: sin proyecto');
select pg_temp.as_user('jhony');
select lives_ok(format($$insert into public.chat_status (user_id, current_project_id) values (%L, %L)$$,
  pg_temp.uid('jhony'), pg_temp.pid(3)), '9e: el admin elige cualquier proyecto (Vantage)');
select pg_temp.as_user('rober');
select throws_ok(format($$insert into public.chat_status (user_id, current_project_id) values (%L, %L)$$,
  pg_temp.uid('rober'), pg_temp.pid(2)), '23505', null, 'ya existe su fila: no se crea otra');
-- Si pierde el acceso despues, sus otros cambios siguen funcionando mientras no cambie de proyecto.
select pg_temp.as_system();
select lives_ok(format($$delete from public.project_members where project_id = %L and user_id = %L$$,
  pg_temp.pid(1), pg_temp.uid('alex')), 'se retira a alex del proyecto 1');
select pg_temp.as_user('alex');
select lives_ok($$update public.chat_status set status = 'Sin proyecto' where user_id = auth.uid()$$,
  '9e: sin acceso al proyecto, cambiar el estado sigue funcionando');
select throws_ok(format($$update public.chat_status set current_project_id = %L where user_id = auth.uid()$$, pg_temp.pid(1)),
  '42501', 'No tienes acceso a ese proyecto.', '9e: ya no puede elegir el proyecto 1');

-- ================================================================ 9f y 10: aislamiento y presencia
select pg_temp.as_user('diego');
select lives_ok(format($$insert into public.chat_status (user_id) values (%L)$$, pg_temp.uid('diego')), 'diego crea su estado');
select throws_like(format($$insert into public.chat_status (user_id, status) values (%L, 'suplantado')$$, pg_temp.uid('rober')),
  'new row violates row-level security%', '9f: diego no crea el estado de otra persona');
select throws_like(format($$insert into public.chat_preferences (user_id) values (%L)$$, pg_temp.uid('rober')),
  'new row violates row-level security%', '9f: diego no crea las preferencias de otra persona');
select is(pg_temp.affected(format($$update public.chat_status set status = 'ajeno' where user_id = %L$$, pg_temp.uid('rober'))), 0,
  '9f: diego no cambia el estado de rober');
select is((select status from public.chat_status where user_id = pg_temp.uid('rober')), 'Disponible',
  '9f: el estado de rober sigue igual');
select throws_ok(format($$update public.chat_status set user_id = %L where user_id = auth.uid()$$, pg_temp.uid('jose')),
  '42501', null, '9f: no se reasigna la fila a otra persona (sin privilegio sobre user_id)');
select throws_ok($$update public.chat_status set updated_at = now() where user_id = auth.uid()$$,
  '42501', null, 'el cliente no escribe updated_at');
select throws_ok($$delete from public.chat_status where user_id = auth.uid()$$, '42501', null, 'nadie borra su estado');
select lives_ok(format($$insert into public.chat_preferences (user_id, sound) values (%L, 'bell')$$, pg_temp.uid('diego')),
  'diego crea sus preferencias');

-- 10: la presencia es una columna que los demas pueden leer.
select pg_temp.as_user('alex');
select is((select presence from public.chat_status where user_id = pg_temp.uid('rober')), false,
  '10: los demas leen que rober oculta su presencia');
select is((select presence from public.chat_status where user_id = pg_temp.uid('diego')), true,
  '10: y que diego la tiene activada');
select is((select count(*)::int from public.chat_status), 5, 'cualquier miembro activo lee el estado de todos');
select pg_temp.as_user('jhony');
select is((select count(*)::int from public.chat_status), 5, 'el admin tambien');

-- Preferencias: privadas, ni el admin las lee.
select is((select count(*)::int from public.chat_preferences), 0, '9f: el admin no lee preferencias ajenas');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.chat_preferences), 0, '9f: rober no lee preferencias ajenas');
select is(pg_temp.affected($$update public.chat_preferences set sound = 'none'$$), 0, '9f: rober no cambia preferencias ajenas');
select pg_temp.as_user('alex');
select is((select sound::text from public.chat_preferences where user_id = pg_temp.uid('alex')), 'none',
  '9f: las preferencias de alex no cambiaron');
select pg_temp.as_user('diego');
select is((select sound::text from public.chat_preferences where user_id = pg_temp.uid('diego')), 'bell',
  '9f: las de diego tampoco');

-- ================================================================ anon e inactivos
select pg_temp.as_anon();
select throws_ok($$select * from public.chat_status$$, '42501', null, 'anon no lee estados');
select throws_ok($$select * from public.chat_preferences$$, '42501', null, 'anon no lee preferencias');
select pg_temp.as_system();
update public.profiles set active = false where id = pg_temp.uid('diego');
select pg_temp.as_user('diego');
select is((select count(*)::int from public.chat_status), 0, 'un perfil inactivo no lee estados');
select is((select count(*)::int from public.chat_preferences), 0, 'un perfil inactivo no lee sus preferencias');
select is(pg_temp.affected($$update public.chat_status set status = 'x' where user_id = auth.uid()$$), 0,
  'un perfil inactivo no cambia su estado');
select throws_like(format($$insert into storage.objects (bucket_id, name, owner) values ('chat-wallpapers', %L, auth.uid())$$,
  pg_temp.uid('diego') || '/fondo-1.webp'), 'new row violates row-level security%', 'un perfil inactivo no sube fondos');

-- ================================================================ funciones
select pg_temp.as_system();
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname in ('chat_status_guard', 'chat_preferences_guard') and p.prosecdef), 0,
  'las guardas son SECURITY INVOKER');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname in ('chat_status_guard', 'chat_preferences_guard')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))), 0,
  'las guardas no son llamables por los clientes');

select * from finish();
rollback;
