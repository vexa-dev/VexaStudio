-- C31: dispositivos y sesiones. Cada persona lista solo sus sesiones activas (sin IP), cierra las
-- demas pero nunca la actual ni una ajena, y anon no ejecuta nada.
-- Ids del seed: 2 Rober, 3 Jose.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create function pg_temp.as_user(p_name text, p_session uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', case p_name when 'rober' then '00000000-0000-4000-8000-000000000002'
                       else '00000000-0000-4000-8000-000000000003' end,
    'role', 'authenticated', 'session_id', p_session)::text, true);
  set local role authenticated;
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end $$;
grant execute on function pg_temp.as_user(text, uuid), pg_temp.as_anon() to authenticated, anon;

-- Fixtures (como propietario): dos sesiones de Rober (una expirada), una de Jose.
insert into auth.sessions (id, user_id, user_agent, ip, created_at, updated_at, not_after) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0', '10.1.1.1', now() - interval '2 days', now() - interval '1 hour', null),
  ('aaaaaaaa-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1', '10.2.2.2', now() - interval '3 days', now() - interval '1 day', null),
  ('aaaaaaaa-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Viejo', '10.3.3.3', now() - interval '9 days', now() - interval '8 days', now() - interval '1 day'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'Mozilla/5.0 Firefox/121.0', '10.4.4.4', now() - interval '1 day', now(), null);

-- ================================================================ permisos y definicion
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('list_my_sessions', 'revoke_my_session')
    and p.prosecdef and p.proconfig::text like '%search_path=%'), 2,
  'ambas funciones son SECURITY DEFINER con search_path fijo');
select ok(has_function_privilege('authenticated', 'public.list_my_sessions()', 'execute')
  and has_function_privilege('authenticated', 'public.revoke_my_session(uuid)', 'execute'),
  'authenticated ejecuta ambas');
select ok(not has_function_privilege('anon', 'public.list_my_sessions()', 'execute')
  and not has_function_privilege('anon', 'public.revoke_my_session(uuid)', 'execute'),
  'anon no ejecuta ninguna');
select ok(not (select 'ip' = any (proargnames) from pg_proc where proname = 'list_my_sessions'
  and pronamespace = 'public'::regnamespace), 'la lista no declara una columna de IP');

-- ================================================================ listar
select pg_temp.as_user('rober', 'aaaaaaaa-0000-4000-8000-000000000001');
select is((select count(*)::int from public.list_my_sessions()), 2,
  'rober ve solo sus 2 sesiones vigentes (la expirada y la de jose no)');
select is((select count(*)::int from public.list_my_sessions() where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 0,
  'no aparece la sesion de otra persona');
select is((select id::text from public.list_my_sessions() where is_current), 'aaaaaaaa-0000-4000-8000-000000000001',
  'is_current marca la sesion del JWT');
select is((select count(*)::int from public.list_my_sessions() where is_current), 1, 'solo una es la actual');
select is((select bool_or(to_jsonb(t) ? 'ip') from public.list_my_sessions() t), false,
  'ninguna fila devuelve la IP');
select is((select user_agent like '%iPhone%' from public.list_my_sessions() where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  true, 'devuelve el user agent');

-- ================================================================ cerrar
select throws_ok($$select public.revoke_my_session('aaaaaaaa-0000-4000-8000-000000000001')$$, '22023', null,
  'no se cierra la sesion actual');
select throws_ok($$select public.revoke_my_session('bbbbbbbb-0000-4000-8000-000000000001')$$, 'P0002', null,
  'no se cierra la sesion de otra persona');
select throws_ok($$select public.revoke_my_session('cccccccc-0000-4000-8000-000000000009')$$, 'P0002', null,
  'una sesion inexistente da error claro');
select lives_ok($$select public.revoke_my_session('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'rober cierra su otra sesion');
select is((select count(*)::int from public.list_my_sessions()), 1, 'queda solo la actual');
select pg_temp.as_user('jose', 'bbbbbbbb-0000-4000-8000-000000000001');
select is((select count(*)::int from public.list_my_sessions()), 1, 'la sesion de jose sigue intacta');

-- ================================================================ anon
select pg_temp.as_anon();
select throws_ok($$select * from public.list_my_sessions()$$, '42501', null, 'anon no lista sesiones');
select throws_ok($$select public.revoke_my_session('bbbbbbbb-0000-4000-8000-000000000001')$$, '42501', null,
  'anon no cierra sesiones');

select * from finish();
rollback;
