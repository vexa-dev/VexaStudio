-- C31: adjuntos del chat en Storage e historial compartido en el servidor (B5d).
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(108);

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
create function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.mid(p_n int) returns uuid language sql immutable as $$
  select ('10000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid $$;
create function pg_temp.t(p_name text) returns uuid language sql stable as $$
  select current_setting('t.' || p_name)::uuid $$;
-- Ruta correcta de un adjunto: <hilo>/<mensaje>/<archivo>.
create function pg_temp.pth(p_thread text, p_n int, p_file text) returns text language sql stable as $$
  select pg_temp.t(p_thread)::text || '/' || pg_temp.mid(p_n)::text || '/' || p_file $$;
-- INSERT de un objeto (quien llama es el dueno). p_size nulo = objeto sin metadata de tamano.
create function pg_temp.obj(p_thread text, p_n int, p_file text, p_size int) returns text
language sql stable as $$
  select format($f$insert into storage.objects (bucket_id, name, owner, metadata)
    values ('chat-attachments', %L, auth.uid(), %L::jsonb)$f$,
    pg_temp.pth(p_thread, p_n, p_file),
    case when p_size is null then null else jsonb_build_object('size', p_size)::text end) $$;
-- INSERT de un mensaje con adjunto: la ruta, el nombre, el tipo y el tamano se pasan tal cual.
create function pg_temp.att(p_author text, p_thread text, p_n int, p_path text, p_name text, p_mime text,
  p_size int, p_body text default '') returns text language sql stable as $$
  select format($f$insert into public.chat_messages
    (id, thread_id, author_id, body, attachment_path, attachment_name, attachment_mime, attachment_size)
    values (%L, %L, %L, %L, %L, %L, %L, %L)$f$,
    pg_temp.mid(p_n), pg_temp.t(p_thread), pg_temp.uid(p_author), p_body, p_path, p_name, p_mime, p_size) $$;
-- Objetos del bucket visibles dentro de la carpeta de un hilo; -1 si el rol ni siquiera puede consultar.
create function pg_temp.vis(p_thread text) returns int language plpgsql as $$
declare n int;
begin
  select count(*)::int into n from storage.objects
  where bucket_id = 'chat-attachments' and name like pg_temp.t(p_thread)::text || '/%';
  return n;
exception when insufficient_privilege then
  return -1;
end $$;
-- Ids (en orden) que devuelve el historial compartido.
create function pg_temp.shared(p_thread text, p_before timestamptz default null, p_limit int default 200)
returns uuid[] language sql stable as $$
  select coalesce(array_agg(s.id), '{}') from (
    select id from public.chat_list_shared(pg_temp.t(p_thread), p_before, p_limit)
  ) s $$;
grant execute on all functions in schema pg_temp to public;

-- ================================================================ bucket
select pg_temp.as_system();
select is((select public from storage.buckets where id = 'chat-attachments'), false, 'chat-attachments es privado');
select is((select file_size_limit from storage.buckets where id = 'chat-attachments'), 26214400::bigint,
  'chat-attachments limita a 25 MiB');
select ok((select allowed_mime_types @> array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf',
    'application/zip', 'application/x-zip-compressed', 'application/vnd.rar',
    'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown', 'application/octet-stream']
  from storage.buckets where id = 'chat-attachments'),
  'la lista de tipos incluye imagenes, video, pdf, comprimidos, Office, texto y archivos de diseno');
select is((select count(*)::int from storage.buckets b, unnest(b.allowed_mime_types) m
  where b.id = 'chat-attachments' and (m ~* 'exec|msdownload|msdos|dosexec|javascript|x-sh|html|x-msi|java-archive')), 0,
  'la lista de tipos no incluye ejecutables ni scripts');
select is((select cardinality(allowed_mime_types) from storage.buckets where id = 'chat-attachments'), 24,
  'la lista de tipos tiene exactamente 24 entradas');

-- ================================================================ politicas (catalogo)
select is((select string_agg(policyname || ':' || cmd, ',' order by policyname) from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'chat\_attachments\_%'),
  'chat_attachments_delete_own:DELETE,chat_attachments_insert:INSERT,chat_attachments_select:SELECT',
  'tres politicas: lectura, subida y baja propia (sin UPDATE)');
select ok((select bool_and(roles = '{authenticated}') from pg_policies
  where schemaname = 'storage' and policyname like 'chat\_attachments\_%'), 'las politicas son solo de authenticated');
select ok((select bool_and(coalesce(qual, with_check) like '%chat_can_access%'
    and coalesce(qual, with_check) like '%auth_role()%' and coalesce(qual, with_check) like '%chat-attachments%'
    and coalesce(qual, with_check) like '%foldername%')
  from pg_policies where schemaname = 'storage' and policyname like 'chat\_attachments\_%'),
  'todas exigen perfil activo, su bucket y acceso al hilo de la primera carpeta');
select ok((select qual like '%owner%' and qual like '%auth.uid()%'
  from pg_policies where schemaname = 'storage' and policyname = 'chat_attachments_delete_own'),
  'la baja queda atada al dueno del objeto (quien lo subio)');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and (qual like '%chat-attachments%' or with_check like '%chat-attachments%') and cmd in ('UPDATE', 'ALL')), 0,
  'ninguna politica permite cambiar objetos del bucket: son inmutables');

-- ================================================================ indice y funcion
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'chat_messages'
  and indexname = 'chat_messages_shared_idx' and indexdef like '%(thread_id, created_at DESC)%'
  and indexdef like '%WHERE (attachment_path IS NOT NULL)%'), 'existe el indice parcial del historial compartido');
select ok(not has_function_privilege('anon', 'public.chat_list_shared(uuid, timestamptz, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_list_shared(uuid, timestamptz, integer)', 'execute'),
  'chat_list_shared solo la ejecuta authenticated');
select ok((select not p.prosecdef and p.provolatile = 's' and p.proretset
  from pg_proc p where p.oid = 'public.chat_list_shared(uuid, timestamptz, integer)'::regprocedure),
  'chat_list_shared es SECURITY INVOKER, estable y devuelve un conjunto');

-- ================================================================ preparacion
-- G: grupo con Rober, Jose y Diego (Jhony lo crea y entra). Se retira a Jhony de los integrantes para
-- comprobar que el admin accede por ser admin y no por integrante.
select pg_temp.as_user('jhony');
select set_config('t.g', public.chat_save_group(null, 'Equipo', '', array[pg_temp.uid('rober'), pg_temp.uid('jose'), pg_temp.uid('diego')])::text, true);
select pg_temp.as_user('rober');
select set_config('t.d_rj', public.chat_direct_thread(pg_temp.uid('jose'))::text, true);
select set_config('t.d_ar', public.chat_direct_thread(pg_temp.uid('alex'))::text, true);
select pg_temp.as_user('alex');
select set_config('t.d_ad', public.chat_direct_thread(pg_temp.uid('diego'))::text, true);
select pg_temp.as_system();
delete from public.chat_members where thread_id = pg_temp.t('g') and user_id = pg_temp.uid('jhony');
select is((select count(*)::int from public.chat_members where thread_id = pg_temp.t('g')), 3,
  'el grupo queda con tres integrantes y sin Jhony');

-- ================================================================ subir: quien puede
select pg_temp.as_user('rober');
select lives_ok(pg_temp.obj('g', 1, 'f.pdf', 100), 'un integrante sube un objeto a <hilo>/<mensaje>/f.pdf');
select pg_temp.as_user('jose');
select lives_ok(pg_temp.obj('g', 2, 'f.pdf', 100), 'otro integrante tambien');
select pg_temp.as_user('alex');
select throws_like(pg_temp.obj('g', 3, 'f.pdf', 100), 'new row violates row-level security%',
  'quien no es integrante no sube al grupo');
select throws_like(pg_temp.obj('d_rj', 3, 'f.pdf', 100), 'new row violates row-level security%',
  'ni a un directo ajeno');
select pg_temp.as_user('jhony');
select lives_ok(pg_temp.obj('g', 4, 'f.pdf', 100), 'un admin que no es integrante sube a un grupo');
select throws_like(pg_temp.obj('d_rj', 4, 'f.pdf', 100), 'new row violates row-level security%',
  'un admin no sube al directo de otras personas');
select pg_temp.as_anon();
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('chat-attachments', %L)$$,
  pg_temp.pth('g', 5, 'f.pdf')), '42501', null, 'anon no sube');
-- Perfil inactivo.
select pg_temp.as_system();
update public.profiles set active = false where id = pg_temp.uid('diego');
select pg_temp.as_user('diego');
select throws_like(pg_temp.obj('g', 5, 'f.pdf', 100), 'new row violates row-level security%',
  'un perfil inactivo no sube, aunque siga siendo integrante');
select is(pg_temp.vis('g'), 0, 'un perfil inactivo no lee');
select pg_temp.as_system();
update public.profiles set active = true where id = pg_temp.uid('diego');
-- Carpetas que no son un hilo valido: se rechazan por la politica, sin error de conversion.
select pg_temp.as_user('rober');
select throws_like($$insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', 'no-es-uuid/x/f.pdf', auth.uid())$$,
  'new row violates row-level security%', 'una carpeta que no es uuid se rechaza sin error de conversion');
select throws_like($$insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', 'suelto.pdf', auth.uid())$$,
  'new row violates row-level security%', 'un objeto sin carpeta se rechaza');
select throws_like($$insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', '12345678-1234-1234-1234-12345678901g/x/f.pdf', auth.uid())$$,
  'new row violates row-level security%', 'un casi-uuid con un caracter invalido se rechaza');
select throws_like($$insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', '99999999-0000-4000-8000-000000000000/x/f.pdf', auth.uid())$$,
  'new row violates row-level security%', 'un uuid de un hilo que no existe se rechaza');

-- ================================================================ leer, cambiar y borrar
select pg_temp.as_user('diego');
select is(pg_temp.vis('g'), 3, 'un integrante lee los objetos del hilo (los tres subidos)');
select pg_temp.as_user('alex');
select is(pg_temp.vis('g'), 0, 'quien no es integrante no los lee');
select pg_temp.as_user('jhony');
select is(pg_temp.vis('g'), 3, 'un admin lee los objetos de un grupo sin ser integrante');
select is(pg_temp.vis('d_rj'), 0, 'pero no los de un directo ajeno');
select pg_temp.as_anon();
select ok(pg_temp.vis('g') in (-1, 0), 'anon no lee');
select pg_temp.as_user('rober');
select is(pg_temp.affected($$update storage.objects set name = name where bucket_id = 'chat-attachments'$$), 0,
  'nadie cambia objetos: ni el dueno (inmutables)');
select is(pg_temp.affected($$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'chat-attachments'$$), 0,
  'ni su metadata');
-- Storage bloquea el DELETE directo (protect_delete): la baja solo pasa por su API, asi que aqui se
-- verifica por el catalogo que la politica esta atada al dueno y al acceso al hilo.
select ok((select cmd = 'DELETE' and qual like '%owner%' and qual like '%chat_can_access%'
  from pg_policies where schemaname = 'storage' and policyname = 'chat_attachments_delete_own'),
  'la baja es solo del dueno y dentro de un hilo al que aun tiene acceso');

-- ================================================================ mensajes con adjunto
-- Mensaje 10 en el directo Rober-Jose: foto de 100 bytes.
select pg_temp.as_user('rober');
select lives_ok(pg_temp.obj('d_rj', 10, 'foto.png', 100), 'Rober sube foto.png al directo');
select lives_ok(pg_temp.att('rober', 'd_rj', 10, pg_temp.pth('d_rj', 10, 'foto.png'), 'foto.png', 'image/png', 100),
  'un mensaje con adjunto y sin texto se acepta cuando el objeto existe con el prefijo correcto');
select is((select body || '|' || attachment_path || '|' || attachment_name || '|' || attachment_mime || '|' || attachment_size
  from public.chat_messages where id = pg_temp.mid(10)),
  '|' || pg_temp.pth('d_rj', 10, 'foto.png') || '|foto.png|image/png|100', 'se guardan la ruta, el nombre, el tipo y el tamano');
-- Objeto ausente.
select throws_ok(pg_temp.att('rober', 'd_rj', 11, pg_temp.pth('d_rj', 11, 'fantasma.png'), 'fantasma.png', 'image/png', 100),
  'P0001', 'El archivo adjunto no existe en el almacenamiento.', 'se rechaza un adjunto cuyo objeto no existe');
-- Prefijo de otro hilo (el objeto existe, pero en la carpeta del grupo).
select lives_ok(pg_temp.obj('g', 12, 'f.pdf', 100), 'Rober sube un objeto al grupo (mensaje 12)');
select throws_ok(pg_temp.att('rober', 'd_rj', 12, pg_temp.pth('g', 12, 'f.pdf'), 'f.pdf', 'application/pdf', 100),
  'P0001', 'El archivo adjunto no corresponde a este mensaje.', 'la ruta apunta a otro hilo');
-- Prefijo de otro mensaje.
select lives_ok(pg_temp.obj('d_rj', 13, 'f.png', 100), 'Rober sube un objeto para el mensaje 13');
select throws_ok(pg_temp.att('rober', 'd_rj', 14, pg_temp.pth('d_rj', 13, 'f.png'), 'f.png', 'image/png', 100),
  'P0001', 'El archivo adjunto no corresponde a este mensaje.', 'la ruta apunta al id de otro mensaje');
select throws_ok(pg_temp.att('rober', 'd_rj', 15, 'p/a.png', 'a.png', 'image/png', 100),
  'P0001', 'El archivo adjunto no corresponde a este mensaje.', 'una ruta cualquiera se rechaza');
select throws_ok(pg_temp.att('rober', 'd_rj', 15, pg_temp.pth('d_rj', 15, ''), 'a.png', 'image/png', 100),
  'P0001', 'El archivo adjunto no corresponde a este mensaje.', 'la ruta debe incluir un nombre de archivo');
-- Nombre.
select lives_ok(pg_temp.obj('d_rj', 16, 'n.png', 100), 'objeto para las pruebas de nombre');
select throws_ok(pg_temp.att('rober', 'd_rj', 16, pg_temp.pth('d_rj', 16, 'n.png'), '', 'image/png', 100),
  'P0001', 'El nombre del archivo debe tener de 1 a 255 caracteres.', 'nombre vacio');
select throws_ok(pg_temp.att('rober', 'd_rj', 16, pg_temp.pth('d_rj', 16, 'n.png'), '   ', 'image/png', 100),
  'P0001', 'El nombre del archivo debe tener de 1 a 255 caracteres.', 'nombre solo con espacios');
select throws_ok(pg_temp.att('rober', 'd_rj', 16, pg_temp.pth('d_rj', 16, 'n.png'), null, 'image/png', 100),
  'P0001', 'El nombre del archivo debe tener de 1 a 255 caracteres.', 'nombre nulo');
select throws_ok(pg_temp.att('rober', 'd_rj', 16, pg_temp.pth('d_rj', 16, 'n.png'), repeat('a', 256), 'image/png', 100),
  'P0001', 'El nombre del archivo debe tener de 1 a 255 caracteres.', 'nombre de 256 caracteres');
select lives_ok(pg_temp.att('rober', 'd_rj', 16, pg_temp.pth('d_rj', 16, 'n.png'), repeat('a', 255), 'image/png', 100),
  'nombre de 255 caracteres exactos');
-- Tipo y tamano.
select lives_ok(pg_temp.obj('d_rj', 17, 't.png', 100), 'objeto para las pruebas de tipo y tamano');
select throws_ok(pg_temp.att('rober', 'd_rj', 17, pg_temp.pth('d_rj', 17, 't.png'), 't.png', null, 100),
  'P0001', 'El archivo adjunto debe indicar su tipo y su tamaño.', 'tipo nulo');
select throws_ok(pg_temp.att('rober', 'd_rj', 17, pg_temp.pth('d_rj', 17, 't.png'), 't.png', '  ', 100),
  'P0001', 'El archivo adjunto debe indicar su tipo y su tamaño.', 'tipo vacio');
select throws_ok(pg_temp.att('rober', 'd_rj', 17, pg_temp.pth('d_rj', 17, 't.png'), 't.png', 'image/png', null),
  'P0001', 'El archivo adjunto debe indicar su tipo y su tamaño.', 'tamano nulo');
select throws_ok(pg_temp.att('rober', 'd_rj', 17, pg_temp.pth('d_rj', 17, 't.png'), 't.png', 'image/png', 101),
  'P0001', 'El tamaño del archivo no coincide con el subido.', 'el tamano no coincide con el del objeto');
select throws_ok(pg_temp.att('rober', 'd_rj', 17, pg_temp.pth('d_rj', 17, 't.png'), 't.png', 'image/png', 99),
  'P0001', 'El tamaño del archivo no coincide con el subido.', 'ni por debajo');
select lives_ok(pg_temp.obj('d_rj', 18, 'sin-meta.bin', null), 'objeto sin metadata de tamano');
select lives_ok(pg_temp.att('rober', 'd_rj', 18, pg_temp.pth('d_rj', 18, 'sin-meta.bin'), 'sin-meta.bin', 'application/octet-stream', 55),
  'sin metadata de tamano en el objeto, el tamano declarado se acepta');
select lives_ok(format($$insert into storage.objects (bucket_id, name, owner, metadata) values ('chat-attachments', %L, auth.uid(), %L::jsonb)$$,
  pg_temp.pth('d_rj', 19, 'grande.zip'), '{"size": 26214401}'), 'objeto de metadata grande (solo catalogo)');
select throws_like(pg_temp.att('rober', 'd_rj', 19, pg_temp.pth('d_rj', 19, 'grande.zip'), 'grande.zip', 'application/zip', 26214401),
  '%chat_messages_attachment_size_check%', 'el tope de 25 MiB sigue vigente en la tabla');
-- Quien no es integrante no envia.
select pg_temp.as_user('alex');
select throws_ok(pg_temp.att('alex', 'd_rj', 20, pg_temp.pth('d_rj', 20, 'a.png'), 'a.png', 'image/png', 100),
  'P0001', 'No tienes acceso a esta conversación.', 'un no integrante no envia adjuntos');
-- Un texto con adjunto conserva ambos.
select pg_temp.as_user('rober');
select lives_ok(pg_temp.obj('d_rj', 21, 'doc.pdf', 2048), 'objeto para un mensaje con texto');
select lives_ok(pg_temp.att('rober', 'd_rj', 21, pg_temp.pth('d_rj', 21, 'doc.pdf'), 'doc.pdf', 'application/pdf', 2048, '  el informe  '),
  'texto y adjunto en el mismo mensaje');
select is((select body from public.chat_messages where id = pg_temp.mid(21)), 'el informe', 'el texto se guarda recortado');
-- Sin adjunto, las columnas del adjunto se limpian (comportamiento de 11).
select lives_ok(format($$insert into public.chat_messages (id, thread_id, author_id, body, attachment_name, attachment_mime, attachment_size)
  values (%L, %L, %L, 'solo texto', 'x.png', 'image/png', 5)$$, pg_temp.mid(22), pg_temp.t('d_rj'), pg_temp.uid('rober')),
  'un mensaje sin ruta ignora los otros datos del adjunto');
select is((select (attachment_name is null and attachment_mime is null and attachment_size is null)::text
  from public.chat_messages where id = pg_temp.mid(22)), 'true', 'y los deja nulos');

-- ================================================================ reenviar: copiar el objeto a otro hilo
-- Jose reenvia la foto (hilo d_rj) al grupo: copia el objeto a <grupo>/<mensaje nuevo>/foto.png.
select pg_temp.as_user('jose');
select lives_ok(pg_temp.obj('g', 30, 'foto.png', 100), 'Jose copia el objeto a la carpeta del grupo');
select lives_ok(pg_temp.att('jose', 'g', 30, pg_temp.pth('g', 30, 'foto.png'), 'foto.png', 'image/png', 100, 'Reenviado: '),
  'el mensaje reenviado referencia el objeto copiado');
select is((select attachment_path from public.chat_messages where id = pg_temp.mid(30)), pg_temp.pth('g', 30, 'foto.png'),
  'el reenvio apunta a la copia, no al original');
select throws_ok(pg_temp.att('jose', 'g', 31, pg_temp.pth('d_rj', 10, 'foto.png'), 'foto.png', 'image/png', 100, 'Reenviado: '),
  'P0001', 'El archivo adjunto no corresponde a este mensaje.', 'reenviar sin copiar (apuntando al original) se rechaza');
select pg_temp.as_user('alex');
select is(pg_temp.vis('g'), 0, 'quien no esta en el grupo no ve la copia');

-- ================================================================ anular: soft delete
select pg_temp.as_user('jose');
select lives_ok($$select public.chat_react(pg_temp.mid(10), '👍')$$, 'Jose reacciona a la foto');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.chat_reactions where message_id = pg_temp.mid(10)), 1, 'una reaccion antes de anular');
select lives_ok($$update public.chat_messages set deleted_at = now() where id = pg_temp.mid(10)$$, 'Rober anula el mensaje con adjunto');
select is((select (deleted_at is not null)::text || '|' || body || '|' || (attachment_path is null and attachment_name is null
    and attachment_mime is null and attachment_size is null)::text
  from public.chat_messages where id = pg_temp.mid(10)), 'true||true', 'anular vacia texto y columnas del adjunto');
select is((select count(*)::int from public.chat_reactions where message_id = pg_temp.mid(10)), 0, 'anular quita las reacciones');
select throws_ok($$select public.chat_react(pg_temp.mid(10), '👍')$$, 'P0001', 'El mensaje ya no está disponible.',
  'no se reacciona a un mensaje anulado');
select is(pg_temp.vis('d_rj') >= 1, true, 'la guarda no retira el objeto: lo hace el cliente (mejor esfuerzo)');

-- ================================================================ historial compartido (chat_list_shared)
-- Directo Rober-Alex: fechas explicitas y distintas para que el orden/cursor no dependan del reloj.
-- 100 texto simple, 101 adjunto, 102 HTTPS, 103 HTTP, 104 adjunto anulado,
-- 105 www sin esquema, 106 adjunto con enlace, 107 enlace anulado.
select pg_temp.as_user('rober');
insert into storage.objects (bucket_id, name, owner, metadata)
select 'chat-attachments', pg_temp.pth('d_ar', n, 'f.pdf'), auth.uid(), '{"size":100}'::jsonb
from (values (101), (104), (106)) f(n);
-- Explicit timestamps are privileged fixture data, not client-granted INSERT columns.
-- Keep Rober's JWT claims so INSERT guards still validate author/access/attachments.
reset role;
insert into public.chat_messages
  (id, thread_id, author_id, body, attachment_path, attachment_name, attachment_mime, attachment_size, created_at)
select pg_temp.mid(n), pg_temp.t('d_ar'), pg_temp.uid('rober'), body,
  case when attached then pg_temp.pth('d_ar', n, 'f.pdf') end,
  case when attached then 'f.pdf' end,
  case when attached then 'application/pdf' end,
  case when attached then 100 end,
  timestamptz '2025-01-01 00:00:00+00' + (n - 100) * interval '1 minute'
from (values
  (100, 'solo texto', false),
  (101, '', true),
  (102, 'Consulta HTTPS://example.com/documento', false),
  (103, 'Consulta http://example.com/documento', false),
  (104, '', true),
  (105, 'www.example.com sin esquema', false),
  (106, 'https://example.com y adjunto', true),
  (107, 'https://example.com/anulado', false)
) f(n, body, attached);
set local role authenticated;
update public.chat_messages set deleted_at = now() where id in (pg_temp.mid(104), pg_temp.mid(107));

select is(pg_temp.shared('d_ar'), array[pg_temp.mid(106), pg_temp.mid(103), pg_temp.mid(102), pg_temp.mid(101)],
  'historial: solo enlaces http/https y adjuntos, nuevos primero y sin duplicar un mensaje con ambos');
select is((select count(*)::int from public.chat_list_shared(pg_temp.t('d_ar'))
  where id in (pg_temp.mid(100), pg_temp.mid(105))), 0, 'texto simple y www sin esquema no son compartidos');
select is((select count(*)::int from public.chat_list_shared(pg_temp.t('d_ar'))
  where id in (pg_temp.mid(104), pg_temp.mid(107))), 0, 'adjuntos y enlaces anulados no aparecen');
select is((select attachment_path || '|' || attachment_name || '|' || attachment_mime || '|' || attachment_size
  from public.chat_list_shared(pg_temp.t('d_ar')) where id = pg_temp.mid(101)),
  pg_temp.pth('d_ar', 101, 'f.pdf') || '|f.pdf|application/pdf|100', 'el historial conserva los datos del adjunto');
select is((select body from public.chat_list_shared(pg_temp.t('d_ar')) where id = pg_temp.mid(102)),
  'Consulta HTTPS://example.com/documento', 'la busqueda de enlaces ignora mayusculas y conserva el cuerpo');
select is(pg_temp.shared('d_ar', null, 2), array[pg_temp.mid(106), pg_temp.mid(103)], 'limite de dos: primera pagina');
select is(pg_temp.shared('d_ar', '2025-01-01 00:03:00+00', 2), array[pg_temp.mid(102), pg_temp.mid(101)],
  'cursor exclusivo: segunda pagina sin repetir el mensaje de la frontera');
select is(pg_temp.shared('d_ar', '2025-01-01 00:01:00+00'), '{}'::uuid[], 'cursor anterior al primer compartido devuelve vacio');
select is(pg_temp.shared('d_ar', '2025-01-02 00:00:00+00'), pg_temp.shared('d_ar'), 'cursor posterior conserva todos los compartidos');
select is(pg_temp.shared('d_ar', null, 0), '{}'::uuid[], 'limite cero devuelve vacio');
select is(pg_temp.shared('d_ar', null, -1), '{}'::uuid[], 'limite negativo se recorta a cero');
select is(pg_temp.shared('d_ad'), '{}'::uuid[], 'un hilo ajeno no filtra mensajes de otros hilos');
select is((select count(*)::int from public.chat_list_shared('99999999-0000-4000-8000-000000000000')),
  0, 'un hilo inexistente devuelve vacio');

-- Permisos: integrante, externo, admin de grupo/directo, anon, perfil inactivo y acceso revocado.
select pg_temp.as_user('alex');
select is(pg_temp.shared('d_ar'), array[pg_temp.mid(106), pg_temp.mid(103), pg_temp.mid(102), pg_temp.mid(101)],
  'el otro integrante consulta el mismo historial del directo');
select is(pg_temp.shared('g'), '{}'::uuid[], 'un externo no consulta el historial del grupo');
select pg_temp.as_user('jose');
select is(pg_temp.shared('d_ar'), '{}'::uuid[], 'un externo no consulta el historial del directo');
select is(pg_temp.shared('g'), array[pg_temp.mid(30)], 'un integrante consulta el adjunto reenviado al grupo');
select pg_temp.as_user('jhony');
select is(pg_temp.shared('g'), array[pg_temp.mid(30)], 'admin consulta el historial del grupo sin ser integrante');
select is(pg_temp.shared('d_ar'), '{}'::uuid[], 'admin no consulta un directo ajeno');
select pg_temp.as_anon();
select throws_ok($$select * from public.chat_list_shared(pg_temp.t('d_ar'))$$,
  '42501', null, 'anon no puede ejecutar el historial compartido');
select pg_temp.as_system();
update public.profiles set active = false where id = pg_temp.uid('alex');
select pg_temp.as_user('alex');
select is(pg_temp.shared('d_ar'), '{}'::uuid[], 'un perfil inactivo no obtiene historial aunque sea integrante');
select pg_temp.as_system();
update public.profiles set active = true where id = pg_temp.uid('alex');
delete from public.chat_members where thread_id = pg_temp.t('d_ar') and user_id = pg_temp.uid('alex');
select pg_temp.as_user('alex');
select is(pg_temp.shared('d_ar'), '{}'::uuid[], 'quitar a un integrante revoca tambien el historial compartido');

-- Limites del servidor: hilo aislado con 501 enlaces y fechas distintas; no contamina otros casos.
select pg_temp.as_user('jhony');
select set_config('t.l', public.chat_save_group(null, 'Limites de historial', '', array[pg_temp.uid('rober')])::text, true);
select pg_temp.as_user('rober');
-- Privileged timestamp fixture setup; authenticated history queries remain below.
reset role;
insert into public.chat_messages (id, thread_id, author_id, body, created_at)
select pg_temp.mid(1000 + n), pg_temp.t('l'), pg_temp.uid('rober'), 'https://example.com/' || n,
  timestamptz '2025-02-01 00:00:00+00' + n * interval '1 minute'
from generate_series(1, 501) f(n);
set local role authenticated;
select is(cardinality(pg_temp.shared('l')), 200, 'limite omitido usa 200');
select is(cardinality(pg_temp.shared('l', null, null)), 200, 'limite nulo usa 200');
select is(cardinality(pg_temp.shared('l', null, 500)), 500, 'limite maximo permite 500');
select is(cardinality(pg_temp.shared('l', null, 501)), 500, 'limite superior se recorta a 500');
select is(cardinality(pg_temp.shared('l', null, 2147483647)), 500, 'limite integer maximo no supera 500');
select is(pg_temp.shared('l', null, 1), array[pg_temp.mid(1501)], 'limite uno devuelve el enlace mas reciente');
select is(pg_temp.shared('l', '2025-02-01 08:20:00+00', 2), array[pg_temp.mid(1499), pg_temp.mid(1498)],
  'cursor y limite se aplican antes de devolver la pagina');

select pg_temp.as_system();
select * from finish();
rollback;
