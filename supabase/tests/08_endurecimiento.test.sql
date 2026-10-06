-- C26: endurecimiento por defecto. Toda funcion nueva de `public` o `private` creada por
-- `postgres` nace SIN permiso de ejecucion para PUBLIC, anon y authenticated; hace falta un
-- `grant` explicito. Las funciones existentes siguen funcionando para los usuarios del seed.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

-- ---------------------------------------------------------------- funciones nuevas, sin grant
reset role;
create function public.zz_sonda_publica() returns int language sql as 'select 1';
create function private.zz_sonda_privada() returns int language sql as 'select 1';

select ok(not has_function_privilege('anon', 'public.zz_sonda_publica()', 'execute'),
  'funcion nueva en public: anon no ejecuta');
select ok(not has_function_privilege('authenticated', 'public.zz_sonda_publica()', 'execute'),
  'funcion nueva en public: authenticated no ejecuta sin grant');
select ok(not has_function_privilege('public', 'public.zz_sonda_publica()', 'execute'),
  'funcion nueva en public: PUBLIC no ejecuta');
select ok(not has_function_privilege('anon', 'private.zz_sonda_privada()', 'execute'),
  'funcion nueva en private: anon no ejecuta');
select ok(not has_function_privilege('authenticated', 'private.zz_sonda_privada()', 'execute'),
  'funcion nueva en private: authenticated no ejecuta sin grant');
select ok(not has_function_privilege('public', 'private.zz_sonda_privada()', 'execute'),
  'funcion nueva en private: PUBLIC no ejecuta');

-- ---------------------------------------------------------------- el grant explicito sigue valiendo
grant execute on function public.zz_sonda_publica() to authenticated;
grant execute on function private.zz_sonda_privada() to authenticated;
select ok(has_function_privilege('authenticated', 'public.zz_sonda_publica()', 'execute'),
  'grant explicito en public: authenticated ejecuta');
select ok(has_function_privilege('authenticated', 'private.zz_sonda_privada()', 'execute'),
  'grant explicito en private: authenticated ejecuta');
select ok(not has_function_privilege('anon', 'public.zz_sonda_publica()', 'execute'),
  'el grant a authenticated no abre la funcion a anon');

-- ---------------------------------------------------------------- las funciones de la app siguen vivas
select pg_temp.as_user('jhony');
select is(public.is_admin(), true, 'el admin sigue ejecutando is_admin()');
select is(public.verify_audit_chain(), null::bigint, 'el admin verifica la cadena sin errores');
reset role;
select pg_temp.as_user('alex');
select is(public.auth_role(), 'collaborator'::public.user_role, 'el colaborador sigue ejecutando auth_role()');
select is(public.is_admin(), false, 'el colaborador no es admin');

select * from finish();
rollback;
