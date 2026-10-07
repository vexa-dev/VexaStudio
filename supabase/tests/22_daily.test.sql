-- Daily compartido: una fila por persona y por fecha de Lima; admin y socios leen todo, el colaborador
-- solo lo suyo; cada quien escribe solo lo propio y solo de hoy; nadie borra.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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
create function pg_temp.lima_today() returns date language sql stable as $$
  select (now() at time zone 'America/Lima')::date $$;
grant execute on function pg_temp.uid(text), pg_temp.as_user(text), pg_temp.as_anon(), pg_temp.lima_today()
  to authenticated, anon;

-- ================================================================ estructura
select ok((select relrowsecurity from pg_class where oid = 'public.daily_updates'::regclass), 'RLS activado');
select ok(not has_table_privilege('anon', 'public.daily_updates', 'select')
  and not has_table_privilege('authenticated', 'public.daily_updates', 'delete'),
  'anon no lee y nadie borra (sin privilegio DELETE)');

-- ================================================================ insertar lo propio
select pg_temp.as_user('rober');
select lives_ok($$insert into public.daily_updates (date, done, will_do, blockers)
  values (pg_temp.lima_today(), '  Termine el modulo  ', 'Pruebas', '')$$, 'rober envia su daily de hoy (user_id sale de la sesion)');
select is((select user_id from public.daily_updates), pg_temp.uid('rober'), 'user_id es quien llama');
select is((select done from public.daily_updates), 'Termine el modulo', 'el texto se recorta');

-- Mismo dia otra vez: se corrige (upsert), no se duplica.
select throws_ok($$insert into public.daily_updates (date, done) values (pg_temp.lima_today(), 'otra')$$, '23505',
  null, 'un segundo insert del mismo dia choca con la unicidad');
select lives_ok($$insert into public.daily_updates (date, done, will_do, blockers)
  values (pg_temp.lima_today(), 'Corregido', 'Pruebas', 'Nada')
  on conflict (user_id, date) do update set done = excluded.done, will_do = excluded.will_do, blockers = excluded.blockers$$,
  'el upsert del mismo dia corrige el daily');
select is((select count(*)::int from public.daily_updates), 1, 'sigue habiendo una sola fila por persona y fecha');
select is((select done from public.daily_updates), 'Corregido', 'el contenido quedo corregido');

-- ================================================================ lo que se rechaza
select throws_ok($$insert into public.daily_updates (date, done) values (pg_temp.lima_today() - 1, 'ayer')$$, '23514',
  null, 'fecha distinta de hoy (ayer) se rechaza');
select throws_ok($$insert into public.daily_updates (date, done) values (pg_temp.lima_today() + 1, 'manana')$$, '23514',
  null, 'fecha futura se rechaza');
select throws_ok($$insert into public.daily_updates (user_id, date, done)
  values (pg_temp.uid('jose'), pg_temp.lima_today(), 'a nombre de jose')$$, '42501',
  null, 'no se envia el daily de otra persona');
select throws_ok($$insert into public.daily_updates (date, done) values (pg_temp.lima_today() - 2, repeat('x', 2001))$$, '23514',
  null, 'mas de 2000 caracteres se rechaza');
select pg_temp.as_user('jose');
select throws_ok($$insert into public.daily_updates (date, done, will_do) values (pg_temp.lima_today(), '   ', '')$$, '23514',
  null, 'un daily sin contenido se rechaza');
select throws_ok($$delete from public.daily_updates$$, '42501', null, 'nadie borra');
select lives_ok($$update public.daily_updates set done = 'intento ajeno' where user_id = pg_temp.uid('rober')$$,
  'actualizar el daily ajeno no falla pero no toca nada (no lo ve)');
select pg_temp.as_user('rober');
select is((select done from public.daily_updates), 'Corregido', 'el daily de rober no cambio');
select throws_ok($$update public.daily_updates set date = pg_temp.lima_today() - 1$$, '23514',
  null, 'no se mueve el daily a otra fecha');
select throws_ok($$update public.daily_updates set user_id = pg_temp.uid('jose')$$, '42501',
  null, 'user_id no se puede cambiar (sin privilegio de columna)');

-- Un daily de una fecha pasada (fixture como propietario) no se corrige.
select pg_temp.as_user('jose');
reset role;
select set_config('request.jwt.claims', '', true);
alter table public.daily_updates disable trigger daily_updates_guard;
insert into public.daily_updates (user_id, date, done) values (pg_temp.uid('jose'), pg_temp.lima_today() - 3, 'viejo');
insert into public.daily_updates (user_id, date, done) values (pg_temp.uid('alex'), pg_temp.lima_today(), 'de alex');
alter table public.daily_updates enable trigger daily_updates_guard;
select pg_temp.as_user('jose');
select throws_ok($$update public.daily_updates set done = 'tarde' where date = pg_temp.lima_today() - 3$$, '23514',
  null, 'un daily de otra fecha ya no se corrige');

-- ================================================================ visibilidad
select is((select count(*)::int from public.daily_updates), 3, 'un socio ve todos (rober, jose viejo, alex)');
select pg_temp.as_user('jhony');
select is((select count(*)::int from public.daily_updates), 3, 'el admin ve todos');
select pg_temp.as_user('alex');
select is((select string_agg(done, ',') from public.daily_updates), 'de alex', 'el colaborador ve solo el suyo');
select pg_temp.as_anon();
select throws_ok($$select * from public.daily_updates$$, '42501', null, 'anon no lee');

select * from finish();
rollback;
