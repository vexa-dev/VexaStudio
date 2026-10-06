-- Chat: ciclo de vida de los adjuntos (descargas, conservar o liberar espacio, retiro del archivo).
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(71);

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
create function pg_temp.pth(p_thread text, p_n int) returns text language sql stable as $$
  select pg_temp.t(p_thread)::text || '/' || pg_temp.mid(p_n)::text || '/f.pdf' $$;
-- Sube el objeto (quien llama es el dueno) y envia el mensaje con adjunto; quien llama es el autor.
create function pg_temp.send(p_thread text, p_n int) returns void language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('chat-attachments', pg_temp.pth(p_thread, p_n), auth.uid(), '{"size": 100}'::jsonb);
  insert into public.chat_messages (id, thread_id, author_id, body, attachment_path, attachment_name,
    attachment_mime, attachment_size)
  values (pg_temp.mid(p_n), pg_temp.t(p_thread), auth.uid(), '', pg_temp.pth(p_thread, p_n), 'f.pdf',
    'application/pdf', 100);
end $$;
-- Storage bloquea el DELETE directo (protect_delete) salvo con esta marca: asi se evalua la politica
-- real de borrado sin pasar por la API. Devuelve cuantas filas pudo borrar quien llama.
create function pg_temp.del_obj(p_thread text, p_n int) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'chat-attachments' and name = pg_temp.pth(p_thread, p_n);
  get diagnostics n = row_count;
  return n;
end $$;
create function pg_temp.obj_exists(p_thread text, p_n int) returns boolean language sql stable as $$
  select exists (select 1 from storage.objects
    where bucket_id = 'chat-attachments' and name = pg_temp.pth(p_thread, p_n)) $$;
create function pg_temp.dl(p_n int) returns text language sql stable as $$
  select format('select public.chat_mark_attachment_downloaded(%L)', pg_temp.mid(p_n)) $$;
create function pg_temp.ans(p_n int, p_keep boolean) returns text language sql stable as $$
  select format('select public.chat_answer_attachment_keep(%L, %L)', pg_temp.mid(p_n), p_keep) $$;
create function pg_temp.purge(p_n int) returns text language sql stable as $$
  select format('update public.chat_messages set attachment_purged_at = now() where id = %L', pg_temp.mid(p_n)) $$;
create function pg_temp.states(p_n int) returns int language sql stable as $$
  select count(*)::int from public.chat_attachment_states where message_id = pg_temp.mid(p_n) $$;
grant execute on all functions in schema pg_temp to public;

-- ================================================================ estructura, privilegios y politicas
select pg_temp.as_system();
select has_table('public', 'chat_attachment_states', 'existe chat_attachment_states');
select ok((select relrowsecurity from pg_class where oid = 'public.chat_attachment_states'::regclass),
  'chat_attachment_states tiene RLS');
select ok(not has_table_privilege('anon', 'public.chat_attachment_states', 'select')
  and not has_table_privilege('anon', 'public.chat_attachment_states', 'insert')
  and not has_table_privilege('anon', 'public.chat_attachment_states', 'update'),
  'anon no tiene nada en chat_attachment_states');
select ok(not has_table_privilege('authenticated', 'public.chat_attachment_states', 'delete'),
  'nadie borra una descarga registrada');
select ok(has_column_privilege('authenticated', 'public.chat_attachment_states', 'keep', 'update')
  and not has_column_privilege('authenticated', 'public.chat_attachment_states', 'downloaded_at', 'update')
  and not has_column_privilege('authenticated', 'public.chat_attachment_states', 'answered_at', 'update')
  and not has_column_privilege('authenticated', 'public.chat_attachment_states', 'user_id', 'update')
  and not has_column_privilege('authenticated', 'public.chat_attachment_states', 'downloaded_at', 'insert'),
  'el cliente solo escribe keep; las horas las fija el servidor');
select ok(has_column_privilege('authenticated', 'public.chat_messages', 'attachment_purged_at', 'update')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'attachment_purged_at', 'insert')
  and not has_column_privilege('authenticated', 'public.chat_messages', 'attachment_path', 'update'),
  'el cliente solo puede tocar la marca de retiro del mensaje, no la ruta');
select ok((select bool_and(not has_function_privilege('anon', f, 'execute') and has_function_privilege('authenticated', f, 'execute'))
  from unnest(array[
    'public.chat_mark_attachment_downloaded(uuid)'::regprocedure,
    'public.chat_answer_attachment_keep(uuid, boolean)'::regprocedure,
    'public.chat_attachment_all_downloaded(uuid)'::regprocedure,
    'public.chat_attachment_purgeable(uuid)'::regprocedure]) f),
  'las RPC y los ayudantes: anon no, authenticated si');
select ok((select bool_and(not prosecdef) from pg_proc
  where oid in ('public.chat_mark_attachment_downloaded(uuid)'::regprocedure,
    'public.chat_answer_attachment_keep(uuid, boolean)'::regprocedure,
    'public.chat_attachment_all_downloaded(uuid)'::regprocedure,
    'public.chat_attachment_purgeable(uuid)'::regprocedure)),
  'todas son SECURITY INVOKER');
select ok(not has_function_privilege('authenticated', 'private.chat_attachment_states_guard()', 'execute'),
  'la guarda de estados no se ejecuta a mano');
select ok((select roles = '{authenticated}' and cmd = 'DELETE' and qual like '%chat_attachment_purgeable%'
    and qual like '%chat_members%' and qual like '%chat-attachments%'
  from pg_policies where schemaname = 'storage' and policyname = 'chat_attachment_delete_released'),
  'la baja de integrantes existe, es de authenticated y exige "purgeable" e integrante');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'chat_attachments_delete_own'),
  'sigue la baja de quien subio el archivo');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'chat_attachment_states'),
  'las respuestas se publican por Realtime');

-- ================================================================ preparacion
-- D: directo Rober-Jose. G: grupo Rober, Jose, Diego (Jhony, admin, lo crea y se retira). S: grupo de un solo integrante.
select pg_temp.as_user('rober');
select set_config('t.d', public.chat_direct_thread(pg_temp.uid('jose'))::text, true);
select pg_temp.as_user('jhony');
select set_config('t.g', public.chat_save_group(null, 'Equipo', '', array[pg_temp.uid('rober'), pg_temp.uid('jose'), pg_temp.uid('diego')])::text, true);
select set_config('t.s', public.chat_save_group(null, 'Solo', '', array[pg_temp.uid('alex')])::text, true);
select pg_temp.as_system();
delete from public.chat_members where thread_id = pg_temp.t('g') and user_id = pg_temp.uid('jhony');
delete from public.chat_members where thread_id = pg_temp.t('s') and user_id = pg_temp.uid('alex');

-- ================================================================ flujo A: todos liberan (directo, mensaje 1)
select pg_temp.as_user('rober');
select lives_ok($$select pg_temp.send('d', 1)$$, 'Rober envia un archivo');
select is(pg_temp.states(1), 0, 'quien envia no deja fila: su descarga es implicita');
select is(public.chat_attachment_all_downloaded(pg_temp.mid(1)), false, 'falta la descarga de Jose');
select throws_ok(pg_temp.ans(1, false), 'P0001', 'Todavía falta que todos descarguen el archivo.',
  'quien envia no puede responder antes de que Jose descargue');
select pg_temp.as_user('jose');
select throws_ok(pg_temp.ans(1, false), 'P0001', 'Todavía falta que todos descarguen el archivo.',
  'Jose no puede responder sin haber descargado');
select lives_ok(pg_temp.dl(1), 'Jose marca la descarga');
select lives_ok(pg_temp.dl(1), 'marcar otra vez no falla ni duplica');
select is(pg_temp.states(1), 1, 'una sola fila de descarga');
select ok((select downloaded_at > clock_timestamp() - interval '1 minute' and downloaded_at <= clock_timestamp()
    and keep is null and answered_at is null
  from public.chat_attachment_states where message_id = pg_temp.mid(1) and user_id = pg_temp.uid('jose')),
  'la hora la fija el servidor y nace sin respuesta');
select is(public.chat_attachment_all_downloaded(pg_temp.mid(1)), true, 'con Jose descargado, todos descargaron (el emisor es implicito)');
select is(public.chat_attachment_purgeable(pg_temp.mid(1)), false, 'sin respuestas no se puede retirar');
-- Nadie mas escribe ni lee estas filas
select throws_ok($$insert into public.chat_attachment_states (message_id, user_id)
  values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')$$,
  'P0001', 'Solo puedes registrar tu propia descarga.', 'Jose no registra la descarga de Rober');
select throws_like($$update public.chat_attachment_states set downloaded_at = now()
  where message_id = '10000000-0000-4000-8000-000000000001'$$, 'permission denied%', 'no se edita la hora de descarga');
select throws_like($$delete from public.chat_attachment_states where message_id = '10000000-0000-4000-8000-000000000001'$$,
  'permission denied%', 'no se deshace una descarga');
select pg_temp.as_user('alex');
select throws_ok(pg_temp.dl(1), 'P0001', 'El mensaje ya no está disponible.', 'quien no es del hilo no marca descarga');
select is(pg_temp.states(1), 0, 'ni ve las filas de un hilo ajeno');
select throws_ok(pg_temp.ans(1, false), 'P0001', 'El mensaje ya no está disponible.', 'ni responde');
select pg_temp.as_anon();
select throws_like(pg_temp.dl(1), 'permission denied%', 'anon no ejecuta las RPC');
select throws_like($$select * from public.chat_attachment_states$$, 'permission denied%', 'anon no lee la tabla');

select pg_temp.as_user('rober');
select is(pg_temp.states(1), 1, 'Rober ve la fila de Jose');
select is((select public.chat_answer_attachment_keep(pg_temp.mid(1), false)), false,
  'Rober (emisor) libera; aun no se puede retirar');
select is(pg_temp.states(1), 2, 'al responder se crea la fila del emisor');
select throws_ok(pg_temp.ans(1, true), 'P0001', 'Ya respondiste sobre este archivo.', 'cada quien responde una sola vez');
select is(pg_temp.affected($$update public.chat_attachment_states set keep = true
  where message_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000003'$$), 0,
  'Rober no cambia la respuesta de Jose');
select pg_temp.as_user('jose');
select is(pg_temp.del_obj('d', 1), 0, 'con una respuesta pendiente un integrante que no es dueno no retira el objeto');
select throws_ok(pg_temp.purge(1), 'P0001', 'Todavía no todos liberaron el archivo.', 'ni registra el retiro');
select is((select public.chat_answer_attachment_keep(pg_temp.mid(1), false)), true, 'Jose libera: ahora todos liberaron');
select is(public.chat_attachment_purgeable(pg_temp.mid(1)), true, 'se puede retirar');
select ok((select answered_at is not null and keep is false from public.chat_attachment_states
  where message_id = pg_temp.mid(1) and user_id = pg_temp.uid('jose')), 'la respuesta queda con hora del servidor');
select throws_ok(pg_temp.purge(1), 'P0001', 'El archivo todavía está en el almacenamiento.',
  'no se marca el retiro mientras el objeto exista');
select pg_temp.as_user('alex');
select is(pg_temp.del_obj('d', 1), 0, 'quien no es integrante no retira el objeto');
select pg_temp.as_user('jose');
select is(pg_temp.del_obj('d', 1), 1, 'un integrante (no dueno) retira el objeto cuando todos liberaron');
select is(pg_temp.obj_exists('d', 1), false, 'el objeto ya no esta');
select lives_ok(pg_temp.purge(1), 'ahora si se registra el retiro');
select ok((select attachment_purged_at > clock_timestamp() - interval '1 minute' and attachment_name = 'f.pdf'
    and attachment_size = 100 and attachment_path is not null and deleted_at is null
  from public.chat_messages where id = pg_temp.mid(1)),
  'el mensaje sigue, con nombre y tamano para el marcador, y la hora es del servidor');
select pg_temp.as_user('rober');
select throws_ok(pg_temp.purge(1), 'P0001', 'El archivo ya fue eliminado para liberar espacio.', 'el retiro se registra una sola vez');
select throws_ok(pg_temp.dl(1), 'P0001', 'El archivo ya fue eliminado para liberar espacio.', 'un archivo retirado no se descarga');
select is(public.chat_attachment_purgeable(pg_temp.mid(1)), false, 'ya retirado: no queda nada por retirar');

-- ================================================================ flujo B: uno conserva (directo, mensaje 2)
select pg_temp.as_user('rober');
select pg_temp.send('d', 2);
select pg_temp.as_user('jose');
select public.chat_mark_attachment_downloaded(pg_temp.mid(2));
select lives_ok(pg_temp.dl(2), 'Jose descarga el mensaje 2');
select is((select public.chat_answer_attachment_keep(pg_temp.mid(2), true)), false, 'Jose conserva: no se puede retirar');
select pg_temp.as_user('rober');
select is((select public.chat_answer_attachment_keep(pg_temp.mid(2), false)), false, 'aunque Rober libere, uno conservo');
select is(public.chat_attachment_purgeable(pg_temp.mid(2)), false, 'conservar gana');
select pg_temp.as_user('jose');
select is(pg_temp.del_obj('d', 2), 0, 'la baja de integrantes no abre cuando alguien conservo');
select throws_ok(pg_temp.purge(2), 'P0001', 'Todavía no todos liberaron el archivo.', 'sin liberacion total no se registra el retiro');

-- ================================================================ flujo C: alguien sin responder (mensaje 3)
select pg_temp.as_user('rober');
select pg_temp.send('d', 3);
select pg_temp.as_user('jose');
select public.chat_mark_attachment_downloaded(pg_temp.mid(3));
select is((select public.chat_answer_attachment_keep(pg_temp.mid(3), false)), false, 'Jose libera; Rober (emisor) no ha respondido');
select is(public.chat_attachment_purgeable(pg_temp.mid(3)), false, 'quien no responde equivale a conservar');
select is(pg_temp.del_obj('d', 3), 0, 'y la baja de integrantes no abre (Jose no es el dueno)');

-- ================================================================ flujo D: grupo, admin que no es integrante (mensaje 4)
select pg_temp.as_user('rober');
select pg_temp.send('g', 4);
select pg_temp.as_user('jose');
select public.chat_mark_attachment_downloaded(pg_temp.mid(4));
select pg_temp.as_user('rober');
select throws_ok(pg_temp.ans(4, false), 'P0001', 'Todavía falta que todos descarguen el archivo.', 'falta que Diego descargue');
select pg_temp.as_user('diego');
select public.chat_mark_attachment_downloaded(pg_temp.mid(4));
select pg_temp.as_user('jhony');
select is(pg_temp.states(4), 2, 'el admin del grupo lee los estados aunque no sea integrante');
select throws_ok(pg_temp.dl(4), 'P0001', 'Solo los integrantes de la conversación pueden hacerlo.', 'pero no marca descarga');
select throws_ok(pg_temp.ans(4, false), 'P0001', 'Solo los integrantes de la conversación pueden hacerlo.', 'ni responde');
select pg_temp.as_user('rober');
select public.chat_answer_attachment_keep(pg_temp.mid(4), false);
select pg_temp.as_user('jose');
select public.chat_answer_attachment_keep(pg_temp.mid(4), false);
select is(public.chat_attachment_purgeable(pg_temp.mid(4)), false, 'falta la respuesta de Diego');
select pg_temp.as_user('diego');
select is((select public.chat_answer_attachment_keep(pg_temp.mid(4), false)), true, 'Diego cierra la ronda: todos liberaron');
select pg_temp.as_user('jhony');
select is(pg_temp.del_obj('g', 4), 0, 'el admin no integrante no retira el objeto');
select pg_temp.as_user('diego');
select is(pg_temp.del_obj('g', 4), 1, 'Diego, integrante, si');

-- ================================================================ flujo E: mensaje anulado y un solo integrante
select pg_temp.as_user('rober');
select pg_temp.send('d', 5);
update public.chat_messages set deleted_at = now() where id = pg_temp.mid(5);
select is(public.chat_attachment_all_downloaded(pg_temp.mid(5)), false, 'un mensaje anulado no tiene ciclo');
select pg_temp.as_user('jose');
select throws_ok(pg_temp.dl(5), 'P0001', 'Este mensaje no tiene un archivo adjunto.', 'ni se descarga');
-- S: Jhony crea el grupo con Alex y luego Alex sale: queda un solo integrante.
select pg_temp.as_system();
delete from public.chat_members where thread_id = pg_temp.t('s') and user_id = pg_temp.uid('alex');
select pg_temp.as_user('jhony');
select pg_temp.send('s', 6);
select is(public.chat_attachment_all_downloaded(pg_temp.mid(6)), false, 'con un solo integrante no hay pregunta');
select throws_ok(pg_temp.ans(6, false), 'P0001', 'Todavía falta que todos descarguen el archivo.', 'y no se puede responder');

select * from finish();
rollback;
