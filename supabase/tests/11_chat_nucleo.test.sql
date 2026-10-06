-- C29: nucleo del chat en la base (B5b). Fija las reglas 1 a 8 del plan: acceso, directos,
-- grupos, enviar, editar/anular, reacciones, lecturas y reenvio. Ids del seed: 1 Jhony (admin),
-- 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(169);

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
-- Id fijo de mensaje y lectura de un id guardado con set_config('t.<nombre>').
create function pg_temp.mid(p_n int) returns uuid language sql immutable as $$
  select ('10000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid $$;
create function pg_temp.t(p_name text) returns uuid language sql stable as $$
  select current_setting('t.' || p_name)::uuid $$;
-- INSERT de un mensaje (la sesion decide quien ejecuta; el autor se indica aparte).
create function pg_temp.ins(p_author text, p_thread text, p_n int, p_body text) returns text
language sql stable as $$
  select format('insert into public.chat_messages (id, thread_id, author_id, body) values (%L, %L, %L, %L)',
    pg_temp.mid(p_n), pg_temp.t(p_thread), pg_temp.uid(p_author), p_body) $$;
create function pg_temp.ins_reply(p_author text, p_thread text, p_n int, p_body text, p_reply int) returns text
language sql stable as $$
  select format('insert into public.chat_messages (id, thread_id, author_id, body, reply_to) values (%L, %L, %L, %L, %L)',
    pg_temp.mid(p_n), pg_temp.t(p_thread), pg_temp.uid(p_author), p_body, pg_temp.mid(p_reply)) $$;
-- Attachment fixtures follow the final Storage contract and authenticated upload policy.
create function pg_temp.pth(p_thread text, p_n int, p_file text) returns text language sql stable as $$
  select pg_temp.t(p_thread)::text || '/' || pg_temp.mid(p_n)::text || '/' || p_file $$;
create function pg_temp.obj(p_thread text, p_n int, p_file text, p_size int) returns text language sql stable as $$
  select format($f$insert into storage.objects (bucket_id, name, owner, metadata)
    values ('chat-attachments', %L, auth.uid(), %L::jsonb)$f$,
    pg_temp.pth(p_thread, p_n, p_file), jsonb_build_object('size', p_size)::text) $$;
grant execute on all functions in schema pg_temp to public;

-- ================================================================ estructura
select pg_temp.as_system();
select has_table('public', 'chat_threads', 'existe chat_threads');
select has_table('public', 'chat_members', 'existe chat_members');
select has_table('public', 'chat_reads', 'existe chat_reads');
select has_table('public', 'chat_messages', 'existe chat_messages');
select has_table('public', 'chat_reactions', 'existe chat_reactions');
select enum_has_labels('public', 'chat_thread_kind', array['direct', 'group'], 'el tipo de conversacion');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('chat_threads', 'chat_members', 'chat_reads', 'chat_messages', 'chat_reactions')
    and c.relrowsecurity), 5, 'las cinco tablas del chat tienen RLS');
select is((select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname like 'chat\_%' and t.tgname like 'audit%' and not t.tgisinternal), 0,
  'el chat no se audita (ni chat_messages ni el resto)');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
  and tablename in ('chat_threads', 'chat_members', 'chat_reads', 'chat_messages', 'chat_reactions')), 5,
  'Realtime publica las cinco tablas');

-- ================================================================ privilegios
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname like 'chat\_%' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))), 0,
  'anon no tiene acceso a ninguna tabla del chat');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname like 'chat\_%' and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'delete')), 0, 'authenticated no borra en el chat');
select ok(not has_table_privilege('authenticated', 'public.chat_threads', 'insert')
  and not has_table_privilege('authenticated', 'public.chat_threads', 'update')
  and not has_table_privilege('authenticated', 'public.chat_members', 'insert')
  and not has_table_privilege('authenticated', 'public.chat_members', 'update')
  and not has_table_privilege('authenticated', 'public.chat_reactions', 'insert')
  and not has_table_privilege('authenticated', 'public.chat_reactions', 'update'),
  'hilos, integrantes y reacciones solo se escriben con RPC');
select ok(has_column_privilege('authenticated', 'public.chat_messages', 'body', 'update')
  and has_column_privilege('authenticated', 'public.chat_messages', 'edited_at', 'update')
  and has_column_privilege('authenticated', 'public.chat_messages', 'deleted_at', 'update')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'author_id', 'update')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'thread_id', 'update')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'reply_to', 'update')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'attachment_path', 'update')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'created_at', 'update'),
  'un mensaje solo permite actualizar body, edited_at y deleted_at');
select ok(has_column_privilege('authenticated', 'public.chat_messages', 'body', 'insert')
  and has_column_privilege('authenticated', 'public.chat_messages', 'reply_to', 'insert')
  and has_column_privilege('authenticated', 'public.chat_messages', 'attachment_size', 'insert')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'created_at', 'insert')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'deleted_at', 'insert')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'edited_at', 'insert'),
  'un mensaje nuevo no fija fechas');
select ok(has_column_privilege('authenticated', 'public.chat_reads', 'read_at', 'update')
  and has_column_privilege('authenticated', 'public.chat_reads', 'read_at', 'insert')
  and not has_column_privilege('authenticated', 'public.chat_reads', 'user_id', 'update')
  and not has_column_privilege('authenticated', 'public.chat_reads', 'thread_id', 'update'),
  'una lectura solo actualiza read_at');
select ok(not has_function_privilege('anon', 'public.chat_can_access(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_can_access(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.chat_direct_thread(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_direct_thread(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.chat_save_group(uuid, text, text, uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.chat_save_group(uuid, text, text, uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.chat_delete_group(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_delete_group(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.chat_react(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_react(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.chat_mark_read(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_mark_read(uuid)', 'execute'),
  'los RPC del chat solo los ejecuta authenticated');
select ok(has_function_privilege('authenticated', 'private.chat_direct_thread(uuid)', 'execute')
  and has_function_privilege('authenticated', 'private.chat_save_group(uuid, text, text, uuid[])', 'execute')
  and has_function_privilege('authenticated', 'private.chat_delete_group(uuid)', 'execute')
  and has_function_privilege('authenticated', 'private.chat_react(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'private.chat_react(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.chat_messages_guard()', 'execute')
  and not has_function_privilege('authenticated', 'private.chat_messages_after_insert()', 'execute')
  and not has_function_privilege('authenticated', 'private.chat_reads_guard()', 'execute'),
  'solo las implementaciones de los RPC estan abiertas; los guardas no');

-- ================================================================ conversaciones directas (regla 2)
select pg_temp.as_user('jhony');
select set_config('t.d_jr', public.chat_direct_thread(pg_temp.uid('rober'))::text, true);
select ok(current_setting('t.d_jr')::uuid is not null, 'Jhony abre un directo con Rober');
select pg_temp.as_user('rober');
select is(public.chat_direct_thread(pg_temp.uid('jhony')), pg_temp.t('d_jr'),
  'la pareja tiene un solo directo, pidiendolo en el otro orden');
select pg_temp.as_user('jhony');
select is(public.chat_direct_thread(pg_temp.uid('rober')), pg_temp.t('d_jr'), 'y repitiendo la llamada');
select throws_ok($$select public.chat_direct_thread(pg_temp.uid('jhony'))$$, 'P0001', 'Selecciona a otra persona.',
  'no se abre un directo con uno mismo');
select throws_ok($$select public.chat_direct_thread(null)$$, 'P0001', 'Selecciona a otra persona.',
  'ni con nadie');
select throws_ok($$select public.chat_direct_thread(gen_random_uuid())$$, 'P0001',
  'La persona seleccionada no está disponible.', 'la otra persona debe existir');
select pg_temp.as_system();
update public.profiles set active = false where id = pg_temp.uid('diego');
select pg_temp.as_user('jhony');
select throws_ok($$select public.chat_direct_thread(pg_temp.uid('diego'))$$, 'P0001',
  'La persona seleccionada no está disponible.', 'ni estar inactiva');
select pg_temp.as_system();
update public.profiles set active = true where id = pg_temp.uid('diego');
select is((select direct_key || '|' || kind::text || '|' || name || '|' || description from public.chat_threads
  where id = pg_temp.t('d_jr')),
  least(pg_temp.uid('jhony')::text, pg_temp.uid('rober')::text) || ':' || greatest(pg_temp.uid('jhony')::text, pg_temp.uid('rober')::text)
  || '|direct||', 'direct_key = menor:mayor, sin nombre ni descripcion');
select is((select count(*)::int from public.chat_members where thread_id = pg_temp.t('d_jr')), 2,
  'el directo tiene a las dos personas');
select pg_temp.as_user('rober');
select throws_like($$insert into public.chat_threads (kind, direct_key) values ('direct', 'x')$$,
  'permission denied%', 'el cliente no crea hilos');
select pg_temp.as_system();
select throws_like($$insert into public.chat_threads (kind, name) values ('direct', 'sin clave')$$,
  '%chat_threads_shape_check%', 'un directo exige direct_key y nombre vacio');
select throws_like($$insert into public.chat_threads (kind, name, direct_key) values ('group', 'G', 'x')$$,
  '%chat_threads_shape_check%', 'un grupo no lleva direct_key');
select throws_like(format($f$insert into public.chat_threads (kind, direct_key) values ('direct', %L)$f$,
  (select direct_key from public.chat_threads where id = pg_temp.t('d_jr'))),
  '%chat_threads_direct_key_key%', 'direct_key es unica');
-- Otro directo ajeno al admin.
select pg_temp.as_user('jose');
select set_config('t.d_ja', public.chat_direct_thread(pg_temp.uid('alex'))::text, true);
select isnt(pg_temp.t('d_ja'), pg_temp.t('d_jr'), 'otra pareja, otro directo');

-- ================================================================ grupos (regla 3)
select pg_temp.as_user('rober');
select throws_ok($$select public.chat_save_group(null, 'Equipo', '', array[pg_temp.uid('jose')])$$, 'P0001',
  'Solo los administradores pueden gestionar grupos.', 'un socio no crea grupos');
select pg_temp.as_user('jhony');
select throws_ok($$select public.chat_save_group(null, '   ', '', array[pg_temp.uid('jose')])$$, 'P0001',
  'Escribe el nombre del grupo.', 'el nombre es obligatorio tras recortar');
select throws_ok($$select public.chat_save_group(null, repeat('n', 61), '', array[pg_temp.uid('jose')])$$, 'P0001',
  'El nombre del grupo puede tener hasta 60 caracteres.', 'el nombre tiene tope de 60');
select throws_ok($$select public.chat_save_group(null, 'Equipo', repeat('d', 241), array[pg_temp.uid('jose')])$$, 'P0001',
  'La descripción puede tener hasta 240 caracteres.', 'la descripcion tiene tope de 240');
select throws_ok($$select public.chat_save_group(null, 'Equipo', '', array[]::uuid[])$$, 'P0001',
  'Selecciona al menos un integrante.', 'un grupo exige al menos un integrante');
select throws_ok($$select public.chat_save_group(null, 'Equipo', '', null)$$, 'P0001',
  'Selecciona al menos un integrante.', 'la lista nula tampoco vale');
select throws_ok($$select public.chat_save_group(null, 'Equipo', '', array[gen_random_uuid()])$$, 'P0001',
  'Hay integrantes que no están disponibles.', 'los integrantes deben existir y estar activos');
select lives_ok($$select public.chat_save_group(null, repeat('n', 60), repeat('d', 240), array[pg_temp.uid('jose')])$$,
  '60 y 240 caracteres justos se aceptan');
select set_config('t.g_max', (select id::text from public.chat_threads where name = repeat('n', 60)), true);
select set_config('t.g1', public.chat_save_group(null, '  Equipo  ', ' desc ',
  array[pg_temp.uid('rober'), pg_temp.uid('rober'), pg_temp.uid('jose')])::text, true);
select is((select name || '|' || description || '|' || kind::text || '|' || created_by::text from public.chat_threads
  where id = pg_temp.t('g1')), 'Equipo|desc|group|' || pg_temp.uid('jhony')::text,
  'el grupo se guarda recortado y con su creador');
select is((select string_agg(user_id::text, ',' order by user_id) from public.chat_members where thread_id = pg_temp.t('g1')),
  pg_temp.uid('jhony')::text || ',' || pg_temp.uid('rober')::text || ',' || pg_temp.uid('jose')::text,
  'el creador entra siempre y los duplicados se juntan');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('g1')), 1, 'Rober ve el grupo del que es integrante');
select pg_temp.as_user('diego');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('g1')), 0, 'Diego no ve un grupo ajeno');
-- Editar.
select pg_temp.as_user('rober');
select throws_ok($$select public.chat_save_group(pg_temp.t('g1'), 'Otro', '', array[pg_temp.uid('jose')])$$, 'P0001',
  'Solo los administradores pueden gestionar grupos.', 'un socio no edita grupos');
select pg_temp.as_user('jhony');
select throws_ok($$select public.chat_save_group(pg_temp.t('d_jr'), 'Otro', '', array[pg_temp.uid('jose')])$$, 'P0001',
  'Esta conversación no es un grupo.', 'un directo no se edita como grupo');
select throws_ok($$select public.chat_save_group(pg_temp.t('d_ja'), 'Otro', '', array[pg_temp.uid('jose')])$$, 'P0001',
  'No tienes acceso a esta conversación.', 'ni el directo ajeno');
select throws_ok($$select public.chat_save_group(gen_random_uuid(), 'Otro', '', array[pg_temp.uid('jose')])$$, 'P0001',
  'No tienes acceso a esta conversación.', 'ni un id inexistente');
select is(public.chat_save_group(pg_temp.t('g1'), ' Equipo 2 ', '', array[pg_temp.uid('rober')]), pg_temp.t('g1'),
  'editar devuelve el mismo id');
select is((select name from public.chat_threads where id = pg_temp.t('g1')), 'Equipo 2', 'el nombre cambia, recortado');
select is((select count(*)::int from public.chat_members where thread_id = pg_temp.t('g1')), 2,
  'quedan el admin y Rober');
select pg_temp.as_user('jose');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('g1')), 0,
  'quitar a Jose le revoca el grupo');
select throws_ok($$select public.chat_react(pg_temp.mid(9999), '👍')$$, 'P0001', 'El mensaje ya no está disponible.',
  'un id de mensaje que no existe no aparece');

-- ================================================================ acceso y envio (reglas 1 y 4)
select pg_temp.as_user('rober');
select lives_ok(pg_temp.ins('rober', 'd_jr', 1, '  hola  '), 'Rober envia en su directo');
select is((select body from public.chat_messages where id = pg_temp.mid(1)), 'hola', 'se guarda recortado');
select is((select r.read_at = m.created_at from public.chat_messages m
  join public.chat_reads r on r.thread_id = m.thread_id and r.user_id = m.author_id where m.id = pg_temp.mid(1)), true,
  'enviar fija la lectura del emisor');
select throws_ok(pg_temp.ins('jhony', 'd_jr', 2, 'suplantacion'), 'P0001',
  'Solo puedes enviar mensajes como tú mismo.', 'no se escribe en nombre de otra persona');
select lives_ok(pg_temp.ins_reply('rober', 'd_jr', 3, 'respuesta', 1), 'responder dentro de la conversacion');
select throws_ok(pg_temp.ins_reply('rober', 'd_jr', 4, 'cruzado', 1000), 'P0001',
  'El mensaje original ya no está disponible.', 'responder a un mensaje inexistente');
select pg_temp.as_user('jose');
select lives_ok(pg_temp.ins('jose', 'd_ja', 30, 'hola Alex'), 'Jose envia a Alex');
select pg_temp.as_user('rober');
select throws_ok(pg_temp.ins_reply('rober', 'd_jr', 5, 'cruzado', 30), 'P0001',
  'El mensaje original ya no está disponible.', 'responder a un mensaje de otra conversacion');
select throws_ok(pg_temp.ins('rober', 'd_jr', 6, '   '), 'P0001',
  'Escribe un mensaje o adjunta un archivo.', 'texto vacio sin adjunto');
select lives_ok(pg_temp.obj('d_jr', 7, 'a.png', 100), 'upload attachment-only message fixture');
select lives_ok($$insert into public.chat_messages (id, thread_id, author_id, body, attachment_path, attachment_name, attachment_mime, attachment_size)
  values (pg_temp.mid(7), pg_temp.t('d_jr'), pg_temp.uid('rober'), '   ', pg_temp.pth('d_jr', 7, 'a.png'), 'a.png', 'image/png', 100)$$,
  'un adjunto sin texto se acepta');
select is((select body from public.chat_messages where id = pg_temp.mid(7)), '', 'queda con texto vacio');
select lives_ok(pg_temp.ins('rober', 'd_jr', 8, repeat('a', 4000)), '4000 caracteres se aceptan');
select throws_ok(pg_temp.ins('rober', 'd_jr', 9, repeat('a', 4001)), 'P0001',
  'El mensaje puede tener hasta 4000 caracteres.', '4001 caracteres se rechazan');
select throws_ok(pg_temp.ins('rober', 'd_jr', 10, repeat('a', 3999) || '  '), 'P0001',
  'El mensaje puede tener hasta 4000 caracteres.', 'el tope se mide antes de recortar');
select lives_ok(pg_temp.ins('rober', 'd_jr', 11, repeat('a', 3998) || '  '), '4000 crudos con espacios se aceptan');
select lives_ok(pg_temp.obj('d_jr', 13, 'b.bin', 26214401), 'upload oversized attachment fixture for the database limit');
select throws_like($$insert into public.chat_messages (id, thread_id, author_id, attachment_path, attachment_name, attachment_mime, attachment_size)
  values (pg_temp.mid(13), pg_temp.t('d_jr'), pg_temp.uid('rober'), pg_temp.pth('d_jr', 13, 'b.bin'), 'b.bin', 'application/octet-stream', 26214401)$$, '%chat_messages_attachment_size_check%',
  'el adjunto tiene tope de 25 MiB');
select lives_ok(pg_temp.obj('d_jr', 14, 'a.png', 100), 'upload copied attachment at the forwarded message path');
select lives_ok($$insert into public.chat_messages (id, thread_id, author_id, body, attachment_path, attachment_name, attachment_mime, attachment_size)
  values (pg_temp.mid(14), pg_temp.t('d_jr'), pg_temp.uid('rober'), 'Reenviado: hola', pg_temp.pth('d_jr', 14, 'a.png'), 'a.png', 'image/png', 100)$$,
  'reenviar copia el adjunto con texto "Reenviado: ..."');
-- Quien no es integrante.
select pg_temp.as_user('jose');
select is((select count(*)::int from public.chat_messages where thread_id = pg_temp.t('d_jr')), 0, 'Jose no lee el directo ajeno');
select throws_ok(pg_temp.ins('jose', 'd_jr', 12, 'intruso'), 'P0001', 'No tienes acceso a esta conversación.',
  'ni escribe en el');
select pg_temp.as_user('alex');
select is(pg_temp.affected($$update public.chat_messages set body = 'hackeado' where id = pg_temp.mid(1)$$), 0,
  'otro usuario no edita mensajes ajenos (0 filas)');
select is((select count(*)::int from public.chat_messages), 1, 'Alex solo ve el directo con Jose (1 mensaje)');
select pg_temp.as_user('rober');
select throws_like($$delete from public.chat_messages$$, 'permission denied%', 'el cliente no borra mensajes');
select throws_like($$update public.chat_messages set thread_id = pg_temp.t('g1') where id = pg_temp.mid(1)$$,
  'permission denied%', 'no se mueve un mensaje a otra conversacion');
select throws_like($$update public.chat_messages set author_id = pg_temp.uid('jhony') where id = pg_temp.mid(1)$$,
  'permission denied%', 'no se cambia el autor');
select pg_temp.as_anon();
select throws_like($$select count(*) from public.chat_messages$$, 'permission denied%', 'anon no lee mensajes');
select throws_like($$select public.chat_react(pg_temp.mid(1), 'x')$$, 'permission denied%', 'anon no ejecuta RPC');
select throws_like($$select public.chat_can_access(pg_temp.t('d_jr'))$$, 'permission denied%', 'ni el ayudante de permisos');

-- ---------------------------------------------------------------- perfil inactivo
select pg_temp.as_system();
update public.profiles set active = false where id = pg_temp.uid('rober');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.chat_threads) + (select count(*)::int from public.chat_messages)
  + (select count(*)::int from public.chat_members) + (select count(*)::int from public.chat_reads)
  + (select count(*)::int from public.chat_reactions), 0, 'un perfil inactivo no ve nada del chat');
select throws_ok(pg_temp.ins('rober', 'd_jr', 13, 'inactivo'), 'P0001', 'No tienes acceso a esta conversación.',
  'ni envia');
select throws_ok($$select public.chat_mark_read(pg_temp.t('d_jr'))$$, 'P0001', 'No tienes acceso a esta conversación.',
  'ni marca lecturas');
select throws_ok($$select public.chat_direct_thread(pg_temp.uid('jhony'))$$, 'P0001', 'No tienes acceso a esta conversación.',
  'ni abre directos');
select pg_temp.as_system();
update public.profiles set active = true where id = pg_temp.uid('rober');

-- ---------------------------------------------------------------- admin y grupos ajenos (regla 1)
select pg_temp.as_system();
insert into public.chat_threads (kind, name, created_by) values ('group', 'Soporte', pg_temp.uid('jhony'));
select set_config('t.gx', (select id::text from public.chat_threads where name = 'Soporte'), true);
insert into public.chat_members (thread_id, user_id) values (pg_temp.t('gx'), pg_temp.uid('rober')), (pg_temp.t('gx'), pg_temp.uid('jose'));
select pg_temp.as_user('jhony');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('gx')), 1,
  'el admin ve un grupo del que no es integrante');
select is((select count(*)::int from public.chat_members where thread_id = pg_temp.t('gx')), 2, 'y sus integrantes');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('d_ja')), 0, 'pero no el directo de otras personas');
select is((select count(*)::int from public.chat_messages where thread_id = pg_temp.t('d_ja')), 0, 'ni sus mensajes');
select throws_ok(pg_temp.ins('jhony', 'd_ja', 14, 'espia'), 'P0001', 'No tienes acceso a esta conversación.',
  'ni escribe en el');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('gx')), 0, 'un colaborador no ve el grupo ajeno');
select throws_ok(pg_temp.ins('alex', 'gx', 15, 'intruso'), 'P0001', 'No tienes acceso a esta conversación.',
  'ni escribe');
select pg_temp.as_user('diego');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('gx')), 0, 'un socio no admin no ve un grupo ajeno');
select pg_temp.as_user('jhony');
select lives_ok($$select public.chat_mark_read(pg_temp.t('gx'))$$, 'un admin no integrante marca lectura en un grupo');
select is((select count(*)::int from public.chat_reads where thread_id = pg_temp.t('gx') and user_id = pg_temp.uid('jhony')), 1,
  'y queda su fila de lectura');
select lives_ok(pg_temp.ins('jhony', 'gx', 20, 'hola grupo'), 'el admin envia en el grupo');
select pg_temp.as_user('rober');
select lives_ok(pg_temp.ins('rober', 'gx', 21, 'mensaje de Rober'), 'Rober envia en el grupo');
select lives_ok(pg_temp.ins('rober', 'gx', 22, 'otro de Rober'), 'y otro');
select pg_temp.as_user('jhony');
select throws_ok($$update public.chat_messages set body = 'editado por admin' where id = pg_temp.mid(22)$$, 'P0001',
  'Solo puedes editar o eliminar tus mensajes.', 'el admin no edita el mensaje de otra persona');
select lives_ok($$update public.chat_messages set deleted_at = now() where id = pg_temp.mid(21)$$,
  'el admin anula un mensaje ajeno en un grupo');
select is((select deleted_at is not null and body = '' from public.chat_messages where id = pg_temp.mid(21)), true,
  'queda anulado y vacio');
select pg_temp.as_user('rober');
select lives_ok(pg_temp.ins('rober', 'd_jr', 23, 'otro en el directo'), 'mensaje de Rober en el directo con Jhony');
select pg_temp.as_user('jhony');
select throws_ok($$update public.chat_messages set deleted_at = now() where id = pg_temp.mid(23)$$, 'P0001',
  'Solo puedes editar o eliminar tus mensajes.', 'en un directo ni el admin anula lo ajeno');
select is(pg_temp.affected($$update public.chat_messages set deleted_at = now() where id = pg_temp.mid(30)$$), 0,
  'ni en un directo ajeno (sin acceso: 0 filas)');
select pg_temp.as_system();
select is((select deleted_at is null from public.chat_messages where id = pg_temp.mid(30)), true, 'el mensaje ajeno sigue intacto');

-- ================================================================ editar y anular (regla 5)
select pg_temp.as_user('rober');
select lives_ok($$update public.chat_messages set body = '  corregido  ', edited_at = now() where id = pg_temp.mid(1)$$,
  'el autor edita');
select is((select body || '|' || (edited_at is not null)::text from public.chat_messages where id = pg_temp.mid(1)),
  'corregido|true', 'se guarda recortado y marca edited_at');
select throws_ok($$update public.chat_messages set body = '   ' where id = pg_temp.mid(1)$$, 'P0001',
  'Escribe un mensaje de hasta 4000 caracteres.', 'editar exige texto no vacio');
select throws_ok($$update public.chat_messages set body = repeat('a', 4001) where id = pg_temp.mid(1)$$, 'P0001',
  'Escribe un mensaje de hasta 4000 caracteres.', 'editar tiene tope de 4000');
select lives_ok($$update public.chat_messages set body = repeat('a', 4000) where id = pg_temp.mid(1)$$, 'editar a 4000 se acepta');
select pg_temp.as_user('jhony');
select throws_ok($$update public.chat_messages set body = 'ajeno' where id = pg_temp.mid(1)$$, 'P0001',
  'Solo puedes editar o eliminar tus mensajes.', 'otro integrante no edita');
select throws_ok($$update public.chat_messages set deleted_at = now() where id = pg_temp.mid(1)$$, 'P0001',
  'Solo puedes editar o eliminar tus mensajes.', 'otro integrante no anula en un directo');
select pg_temp.as_user('rober');
select throws_like($$update public.chat_messages set reply_to = pg_temp.mid(3) where id = pg_temp.mid(1)$$,
  'permission denied%', 'no se cambia reply_to');
-- Anular: efectos.
select lives_ok(pg_temp.obj('d_jr', 50, 'x.png', 100), 'upload attachment fixture before soft deletion');
select lives_ok($$insert into public.chat_messages (id, thread_id, author_id, body, attachment_path, attachment_name, attachment_mime, attachment_size)
  values (pg_temp.mid(50), pg_temp.t('d_jr'), pg_temp.uid('rober'), 'foto', pg_temp.pth('d_jr', 50, 'x.png'), 'x.png', 'image/png', 100)$$,
  'mensaje con adjunto para anular');
select pg_temp.as_user('jhony');
select lives_ok($$select public.chat_react(pg_temp.mid(50), '👍')$$, 'Jhony reacciona');
select pg_temp.as_user('rober');
select lives_ok($$select public.chat_react(pg_temp.mid(50), '❤️')$$, 'Rober reacciona');
select is((select count(*)::int from public.chat_reactions where message_id = pg_temp.mid(50)), 2, 'dos reacciones antes de anular');
select lives_ok($$update public.chat_messages set deleted_at = now() where id = pg_temp.mid(50)$$, 'el autor anula');
select is((select (deleted_at is not null)::text || '|' || body || '|' || (attachment_path is null and attachment_name is null
    and attachment_mime is null and attachment_size is null)::text || '|' || (edited_at is null)::text
  from public.chat_messages where id = pg_temp.mid(50)), 'true||true|true',
  'anular es suave: vacia el texto, quita el adjunto y no marca edicion');
select is((select count(*)::int from public.chat_reactions where message_id = pg_temp.mid(50)), 0, 'anular quita las reacciones');
select throws_ok($$update public.chat_messages set deleted_at = now() where id = pg_temp.mid(50)$$, 'P0001',
  'El mensaje ya no está disponible.', 'no se anula dos veces');
select throws_ok($$update public.chat_messages set body = 'revivido' where id = pg_temp.mid(50)$$, 'P0001',
  'El mensaje ya no está disponible.', 'no se edita uno anulado');
select throws_ok($$select public.chat_react(pg_temp.mid(50), '👍')$$, 'P0001',
  'El mensaje ya no está disponible.', 'no se reacciona a uno anulado');
select pg_temp.as_system();
select throws_like($$update public.chat_messages set body = 'x', deleted_at = null where id = pg_temp.mid(50)$$,
  '%El mensaje ya no está disponible.%', 'ni siquiera quien ignora los privilegios toca un mensaje anulado');
select throws_like($$update public.chat_messages set thread_id = pg_temp.t('g1') where id = pg_temp.mid(1)$$,
  '%Solo se puede cambiar%', 'el guarda frena cualquier otra columna');

-- ================================================================ reacciones (regla 6)
select pg_temp.as_user('jhony');
select lives_ok($$select public.chat_react(pg_temp.mid(1), '👍')$$, 'Jhony reacciona con un emoji');
select is((select emoji from public.chat_reactions where message_id = pg_temp.mid(1) and user_id = pg_temp.uid('jhony')),
  '👍', 'queda registrada');
select lives_ok($$select public.chat_react(pg_temp.mid(1), '👍')$$, 'el mismo emoji');
select is((select count(*)::int from public.chat_reactions where message_id = pg_temp.mid(1)), 0, 'lo quita');
select lives_ok($$select public.chat_react(pg_temp.mid(1), '👍')$$, 'reaccionar otra vez');
select lives_ok($$select public.chat_react(pg_temp.mid(1), '❤️')$$, 'con otro emoji');
select is((select string_agg(emoji, ',') from public.chat_reactions where message_id = pg_temp.mid(1)
  and user_id = pg_temp.uid('jhony')), '❤️', 'lo reemplaza: un emoji por persona');
select pg_temp.as_user('rober');
select lives_ok($$select public.chat_react(pg_temp.mid(1), '👍')$$, 'Rober reacciona al mismo mensaje');
select is((select count(*)::int from public.chat_reactions where message_id = pg_temp.mid(1)), 2, 'cada persona tiene la suya');
select throws_ok($$select public.chat_react(pg_temp.mid(1), '')$$, 'P0001',
  'El emoji debe tener de 1 a 16 caracteres.', 'el emoji no puede ser vacio');
select throws_ok($$select public.chat_react(pg_temp.mid(1), repeat('a', 17))$$, 'P0001',
  'El emoji debe tener de 1 a 16 caracteres.', 'ni pasar de 16');
select lives_ok($$select public.chat_react(pg_temp.mid(1), repeat('a', 16))$$, '16 caracteres justos se aceptan');
select pg_temp.as_user('jose');
select throws_ok($$select public.chat_react(pg_temp.mid(1), '👍')$$, 'P0001', 'No tienes acceso a esta conversación.',
  'quien no tiene acceso no reacciona');
select is((select count(*)::int from public.chat_reactions), 0, 'ni ve reacciones ajenas');
select pg_temp.as_user('jhony');
select is((select count(*)::int from public.chat_reactions where message_id = pg_temp.mid(1)), 2, 'Jhony si ve las del directo');
select lives_ok($$select public.chat_react(pg_temp.mid(20), '👍')$$, 'el admin reacciona en un grupo ajeno');
select throws_ok($$select public.chat_react(pg_temp.mid(30), '👍')$$, 'P0001', 'No tienes acceso a esta conversación.',
  'pero no en un directo ajeno');
select throws_like($$insert into public.chat_reactions (message_id, user_id, emoji) values (pg_temp.mid(1), pg_temp.uid('jhony'), 'x')$$,
  'permission denied%', 'el cliente no inserta reacciones directamente');
select pg_temp.as_anon();
select throws_like($$select count(*) from public.chat_reactions$$, 'permission denied%', 'anon no lee reacciones');

-- ================================================================ lecturas (regla 7)
select pg_temp.as_user('jhony');
select lives_ok($$select public.chat_mark_read(pg_temp.t('d_jr'))$$, 'marcar la conversacion como leida');
select set_config('t.r0', (select read_at::text from public.chat_reads
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('jhony')), true);
select lives_ok($$select public.chat_mark_read(pg_temp.t('d_jr'))$$, 'marcar otra vez');
select ok((select read_at >= current_setting('t.r0')::timestamptz from public.chat_reads
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('jhony')), 'la lectura nunca retrocede con marcar');
select throws_ok($$update public.chat_reads set read_at = read_at - interval '1 hour'
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('jhony')$$, 'P0001',
  'La lectura no puede retroceder.', 'un UPDATE no mueve read_at hacia atras');
select throws_ok($$update public.chat_reads set read_at = now() + interval '1 day'
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('jhony')$$, 'P0001',
  'La lectura no puede estar en el futuro.', 'ni al futuro');
select throws_ok($$insert into public.chat_reads (thread_id, user_id, read_at)
  values (pg_temp.t('g_max'), pg_temp.uid('jhony'), now() + interval '1 day')$$, 'P0001',
  'La lectura no puede estar en el futuro.', 'ni insertar una lectura futura');
select throws_like($$insert into public.chat_reads (thread_id, user_id, read_at)
  values (pg_temp.t('d_jr'), pg_temp.uid('rober'), now())$$, '%row-level security%', 'no se escribe la lectura de otra persona');
select is(pg_temp.affected($$update public.chat_reads set read_at = clock_timestamp() where user_id = pg_temp.uid('rober')$$), 0,
  'ni se actualiza la ajena (0 filas)');
select throws_ok($$select public.chat_mark_read(pg_temp.t('d_ja'))$$, 'P0001', 'No tienes acceso a esta conversación.',
  'no se marca lectura en un directo ajeno');
select is((select count(*)::int from public.chat_reads where thread_id = pg_temp.t('d_jr')), 2,
  'se ven las lecturas de la otra persona (para las marcas de leido)');
select pg_temp.as_user('jose');
select is((select count(*)::int from public.chat_reads where thread_id = pg_temp.t('d_jr')), 0, 'quien no tiene acceso no las ve');
select pg_temp.as_user('jhony');
select is((select count(*)::int from public.chat_reads where thread_id = pg_temp.t('d_ja')), 0, 'el admin no ve lecturas de un directo ajeno');
select pg_temp.as_anon();
select throws_like($$select public.chat_mark_read(pg_temp.t('d_jr'))$$, 'permission denied%', 'anon no marca lecturas');

-- ================================================================ borrar grupos (regla 3)
select pg_temp.as_user('rober');
select lives_ok(pg_temp.ins('rober', 'g1', 40, 'primero'), 'Rober escribe en el grupo editado');
select lives_ok(pg_temp.ins_reply('rober', 'g1', 41, 'respuesta', 40), 'una respuesta dentro del grupo');
select pg_temp.as_user('jhony');
select lives_ok($$select public.chat_react(pg_temp.mid(40), '👍')$$, 'una reaccion en el grupo');
select pg_temp.as_user('rober');
select throws_ok($$select public.chat_delete_group(pg_temp.t('g1'))$$, 'P0001',
  'Solo los administradores pueden gestionar grupos.', 'un socio no borra grupos');
select pg_temp.as_user('jhony');
select throws_ok($$select public.chat_delete_group(pg_temp.t('d_jr'))$$, 'P0001',
  'Solo se pueden eliminar grupos.', 'un directo no se borra');
select throws_ok($$select public.chat_delete_group(pg_temp.t('d_ja'))$$, 'P0001',
  'No tienes acceso a esta conversación.', 'ni el directo ajeno');
select throws_ok($$select public.chat_delete_group(gen_random_uuid())$$, 'P0001',
  'No tienes acceso a esta conversación.', 'ni un id inexistente');
select lives_ok($$select public.chat_delete_group(pg_temp.t('g1'))$$, 'el admin borra el grupo');
select pg_temp.as_system();
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('g1'))
  + (select count(*)::int from public.chat_members where thread_id = pg_temp.t('g1'))
  + (select count(*)::int from public.chat_messages where thread_id = pg_temp.t('g1'))
  + (select count(*)::int from public.chat_reads where thread_id = pg_temp.t('g1'))
  + (select count(*)::int from public.chat_reactions where message_id in (pg_temp.mid(40), pg_temp.mid(41))), 0,
  'borrar es real: arrastra integrantes, mensajes, lecturas y reacciones');
select is((select count(*)::int from public.chat_threads where id = pg_temp.t('d_jr')), 1, 'y no toca otras conversaciones');

select * from finish();
rollback;
