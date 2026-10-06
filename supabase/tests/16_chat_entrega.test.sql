-- Chat: marca de entrega (chat_reads.delivered_at, RPC chat_mark_delivered). Ids del seed: 1 Jhony (admin),
-- 2 Rober, 3 Jose (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.uid(p_name text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000000' || case p_name
    when 'jhony' then '1' when 'rober' then '2' when 'jose' then '3' when 'alex' then '5' end)::uuid $$;
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
create function pg_temp.t(p_name text) returns uuid language sql stable as $$
  select current_setting('t.' || p_name)::uuid $$;
grant execute on all functions in schema pg_temp to public;

-- ================================================================ estructura y privilegios
select pg_temp.as_system();
select has_column('public', 'chat_reads', 'delivered_at', 'chat_reads tiene delivered_at');
select col_is_null('public', 'chat_reads', 'delivered_at', 'delivered_at admite nulo (aun no entregado)');
select col_is_null('public', 'chat_reads', 'read_at', 'read_at admite nulo (solo entregado)');
select ok(has_column_privilege('authenticated', 'public.chat_reads', 'delivered_at', 'update')
  and has_column_privilege('authenticated', 'public.chat_reads', 'delivered_at', 'insert')
  and not has_column_privilege('authenticated', 'public.chat_reads', 'user_id', 'update'),
  'la entrega solo toca delivered_at');
select ok(not has_function_privilege('anon', 'public.chat_mark_delivered(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_mark_delivered(uuid)', 'execute'),
  'chat_mark_delivered: anon no, authenticated si');
select ok(not (select prosecdef from pg_proc where oid = 'public.chat_mark_delivered(uuid)'::regprocedure),
  'chat_mark_delivered es SECURITY INVOKER');

-- ================================================================ conversaciones
select pg_temp.as_user('jhony');
select set_config('t.d_jr', public.chat_direct_thread(pg_temp.uid('rober'))::text, true);
select pg_temp.as_user('jose');
select set_config('t.d_ja', public.chat_direct_thread(pg_temp.uid('alex'))::text, true);

-- ================================================================ marcar entregado
select pg_temp.as_user('rober');
select lives_ok($$select public.chat_mark_delivered(pg_temp.t('d_jr'))$$, 'Rober marca la entrega');
select ok((select delivered_at is not null and read_at is null from public.chat_reads
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')),
  'entregar no marca leido: read_at sigue nulo');
select ok((select delivered_at <= clock_timestamp() and delivered_at > clock_timestamp() - interval '1 minute'
  from public.chat_reads where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')),
  'la hora la fija el servidor');
select set_config('t.d0', (select delivered_at::text from public.chat_reads
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')), true);
select lives_ok($$select public.chat_mark_delivered(pg_temp.t('d_jr'))$$, 'marcar otra vez');
select ok((select delivered_at >= current_setting('t.d0')::timestamptz from public.chat_reads
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')), 'la entrega nunca retrocede con marcar');

-- Leer despues no pierde la entrega.
select lives_ok($$select public.chat_mark_read(pg_temp.t('d_jr'))$$, 'leer despues de entregar');
select ok((select delivered_at is not null and read_at is not null from public.chat_reads
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')), 'conserva ambas marcas');

-- ================================================================ guarda
select throws_ok($$update public.chat_reads set delivered_at = delivered_at - interval '1 hour'
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')$$, 'P0001',
  'La entrega no puede retroceder.', 'un UPDATE no mueve delivered_at hacia atras');
select throws_ok($$update public.chat_reads set delivered_at = null
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')$$, 'P0001',
  'La entrega no puede retroceder.', 'ni la borra');
select throws_ok($$update public.chat_reads set delivered_at = now() + interval '1 day'
  where thread_id = pg_temp.t('d_jr') and user_id = pg_temp.uid('rober')$$, 'P0001',
  'La entrega no puede estar en el futuro.', 'ni la lleva al futuro');

-- ================================================================ acceso
select throws_ok($$select public.chat_mark_delivered(pg_temp.t('d_ja'))$$, 'P0001',
  'No tienes acceso a esta conversación.', 'no se entrega en un directo ajeno');
select throws_like($$insert into public.chat_reads (thread_id, user_id, delivered_at)
  values (pg_temp.t('d_jr'), pg_temp.uid('jhony'), now())$$, '%row-level security%',
  'no se escribe la entrega de otra persona');
select pg_temp.as_anon();
select throws_like($$select public.chat_mark_delivered(pg_temp.t('d_jr'))$$, 'permission denied%', 'anon no ejecuta');

select * from finish();
rollback;
