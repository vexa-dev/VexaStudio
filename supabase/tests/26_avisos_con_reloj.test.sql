-- M6: avisos con reloj. Los generadores aceptan `p_now`, asi que nada espera al cron real.
-- Ids del seed: 1 Jhony (admin, 15 h), 2 Rober (20 h), 3 Jose (15 h), 4 Diego (25 h) socios, 5 Alex (colaborador).
-- Fechas simuladas (Lima = UTC-5): lun 2027-03-01 21:00 = 2027-03-02 02:00 UTC; dom 2027-03-07 20:00 = 2027-03-08 01:00 UTC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

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
-- Avisos de un tipo para una persona (se cuenta como sistema, sin RLS).
create function pg_temp.count_of(p_name text, p_type text) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.as_system();
  select count(*)::int into n from public.notifications
  where user_id = pg_temp.uid(p_name) and type::text = p_type;
  return n;
end $$;
-- Quienes recibieron un tipo (por nombre, ordenado).
create function pg_temp.who(p_type text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.as_system();
  select coalesce(string_agg(p.name, ',' order by p.name), '') into r
  from public.notifications n join public.profiles p on p.id = n.user_id where n.type::text = p_type;
  return r;
end $$;
grant execute on all functions in schema pg_temp to public;

-- ---------------------------------------------------------------- estructura y planificador
select pg_temp.as_system();
select has_index('public', 'notifications', 'notifications_dedupe_uidx', 'existe el indice unico de dedupe');
select is((select count(*)::int from cron.job where jobname like 'vexa_%'), 3, 'hay 3 trabajos vexa_* en pg_cron');
select is((select schedule from cron.job where jobname = 'vexa_daily_pending'), '0 2 * * *',
  'daily_pending: 21:00 Lima = 02:00 UTC');
select is((select schedule from cron.job where jobname = 'vexa_hours_missing'), '0 1 * * *',
  'hours_missing: 20:00 Lima = 01:00 UTC');
select is((select schedule from cron.job where jobname = 'vexa_renewals'), '0 14 * * *',
  'renewals: 09:00 Lima = 14:00 UTC');
select cron.schedule('vexa_renewals', '0 14 * * *', 'select private.generate_renewals()');
select is((select count(*)::int from cron.job where jobname like 'vexa_%'), 3,
  'reprogramar un trabajo con nombre no lo duplica');

-- ---------------------------------------------------------------- permisos
select ok(not has_function_privilege('authenticated', 'private.generate_daily_pending(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.generate_daily_pending(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.generate_hours_missing(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.generate_hours_missing(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.generate_renewals(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'private.generate_renewals(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'private.notify_once(uuid, public.notification_type, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.notify_expense_result()', 'execute'),
  'los clientes no ejecutan los generadores ni el trigger');
select pg_temp.as_user('jhony');
select throws_like($$select private.generate_daily_pending()$$, 'permission denied%',
  'ni un admin los invoca desde la API');
select pg_temp.as_anon();
select throws_like($$select private.generate_renewals()$$, 'permission denied%', 'anon tampoco');
select pg_temp.as_system();

-- ---------------------------------------------------------------- daily_pending
-- Jose ya envio su daily del lunes. La guarda solo admite "hoy", asi que se apaga durante la carga.
alter table public.daily_updates disable trigger daily_updates_guard;
insert into public.daily_updates (user_id, date, done) values (pg_temp.uid('jose'), '2027-03-01', 'Listo');
alter table public.daily_updates enable trigger daily_updates_guard;

select is(private.generate_daily_pending('2027-03-03 02:00:00+00'), 0,
  'un martes (Lima) no es dia de recordatorio de daily');
select is(private.generate_daily_pending('2027-03-02 02:00:00+00'), 3,
  'lunes 21:00 Lima: 3 avisos (los socios sin daily)');
select is(pg_temp.who('daily_pending'), 'Diego Choque,Jhony Rivera,Rober Vasquez',
  'avisa a quienes no enviaron la daily; Jose cumplio y Alex (colaborador) no participa');
select is(private.generate_daily_pending('2027-03-02 02:00:00+00'), 0, 'repetir el trabajo no duplica');
select is(pg_temp.count_of('jhony', 'daily_pending'), 1, 'una sola daily_pending por persona y fecha');
select is((select payload ->> 'route' from public.notifications
  where user_id = pg_temp.uid('rober') and type = 'daily_pending'), '/mi-dia', 'el aviso apunta a Mi día');
select is((select payload ->> 'date' from public.notifications
  where user_id = pg_temp.uid('rober') and type = 'daily_pending'), '2027-03-01', 'la fecha del aviso es la de Lima');
select is(private.generate_daily_pending('2027-03-04 02:00:00+00'), 4,
  'el miercoles (otra fecha) se avisa de nuevo, ahora tambien a Jose');
select is(pg_temp.count_of('jhony', 'daily_pending'), 2, 'una daily_pending por cada fecha');
-- Un socio inactivo no recibe avisos.
update public.profiles set active = false where id = pg_temp.uid('diego');
select is(private.generate_daily_pending('2027-03-05 02:00:00+00'), 0, 'un jueves (Lima) no es dia de recordatorio');
select is(private.generate_daily_pending('2027-03-06 02:00:00+00'), 3, 'viernes 21:00 Lima: 3 activos (Diego inactivo no recibe)');
update public.profiles set active = true where id = pg_temp.uid('diego');

-- ---------------------------------------------------------------- hours_missing
-- Semana lun 01 - dom 07 de marzo de 2027. Rober 20 h (cumple), Diego 25 h (justo la meta), Jhony 5 h,
-- Jose 0 h validas (un borrador de 15 h y un registro anulado no cuentan, ni 30 h de la semana anterior).
insert into public.time_entries (user_id, started_at, ended_at, hours) values
  (pg_temp.uid('rober'), '2027-03-03 15:00:00+00', '2027-03-03 20:00:00+00', 20),
  (pg_temp.uid('diego'), '2027-03-04 15:00:00+00', '2027-03-04 20:00:00+00', 25),
  (pg_temp.uid('jhony'), '2027-03-05 15:00:00+00', '2027-03-05 20:00:00+00', 5),
  (pg_temp.uid('jose'), '2027-02-24 15:00:00+00', '2027-02-24 20:00:00+00', 30);
insert into public.time_entries (user_id, started_at, ended_at, hours, draft) values
  (pg_temp.uid('jose'), '2027-03-02 15:00:00+00', '2027-03-02 20:00:00+00', 15, true);
insert into public.time_entries (user_id, started_at, ended_at, hours, voided_at, void_reason) values
  (pg_temp.uid('jose'), '2027-03-02 15:00:00+00', '2027-03-02 20:00:00+00', 15, now(), 'Error');
-- La semana de Lima termina el domingo: un registro del domingo en la noche UTC cuenta en esa semana.
insert into public.time_entries (user_id, started_at, ended_at, hours) values
  (pg_temp.uid('jhony'), '2027-03-08 03:00:00+00', '2027-03-08 04:00:00+00', 10);

select is(private.generate_hours_missing('2027-03-02 01:00:00+00'), 0, 'un lunes no es dia de recordatorio de horas');
insert into public.notification_preferences (user_id, hours_reminder) values (pg_temp.uid('jose'), false);
select is(private.generate_hours_missing('2027-03-08 01:00:00+00'), 0,
  'domingo 20:00 Lima: Jhony (5 + 10 h del domingo = 15 h) cumple, Jose desactivo el aviso, Rober y Diego cumplen');
update public.notification_preferences set hours_reminder = true where user_id = pg_temp.uid('jose');
select is(private.generate_hours_missing('2027-03-08 01:00:00+00'), 1, 'con el aviso activo, Jose (0 h validas) recibe el suyo');
select is(pg_temp.who('hours_missing'), 'José Gónzales', 'solo quien no llego a su meta recibe hours_missing');
select is(private.generate_hours_missing('2027-03-08 01:00:00+00'), 0, 'repetir el trabajo no duplica');
select is((select payload ->> 'weekStart' from public.notifications
  where user_id = pg_temp.uid('jose') and type = 'hours_missing'), '2027-03-01', 'la semana empieza el lunes de Lima');
select is((select payload ->> 'route' from public.notifications
  where user_id = pg_temp.uid('jose') and type = 'hours_missing'), '/horas', 'el aviso apunta a Horas');
-- Si Jhony baja de su meta (se anula el registro del domingo) y se genera otra vez, la dedupe es por semana.
update public.time_entries set voided_at = now(), void_reason = 'Error'
  where user_id = pg_temp.uid('jhony') and hours = 10;
select is(private.generate_hours_missing('2027-03-08 01:00:00+00'), 1, 'Jhony pasa a estar por debajo de su meta: 1 aviso nuevo');
select is(private.generate_hours_missing('2027-03-08 01:00:00+00'), 0, 'y no se repite en la misma semana');

-- ---------------------------------------------------------------- renewal
-- Seed: dominio de VEXA, renovacion el 2027-02-23.
select is(private.generate_renewals('2027-01-23 14:00:00+00'), 0, 'a 31 dias no avisa');
select is(private.generate_renewals('2027-01-24 14:00:00+00'), 1, 'a 30 dias avisa al administrador');
select is(pg_temp.who('renewal'), 'Jhony Rivera', 'solo el administrador recibe renewal');
select is(private.generate_renewals('2027-01-24 14:00:00+00'), 0, 'repetir el trabajo no duplica');
select is(private.generate_renewals('2027-02-16 14:00:00+00'), 1, 'a 7 dias avisa otra vez (otro umbral)');
select is(pg_temp.count_of('jhony', 'renewal'), 2, 'un aviso por umbral');
select is(private.generate_renewals('2027-02-17 14:00:00+00'), 0, 'a 6 dias no avisa');

-- ---------------------------------------------------------------- expense_result
select pg_temp.as_user('rober');
select set_config('t.aprob', (select id::text from public.create_expense(60, 'PEN', 'Licencia anual', 'software')), true);
select set_config('t.rech', (select id::text from public.create_expense(70, 'PEN', 'Compra dudosa', 'other')), true);
select set_config('t.auto', (select id::text from public.create_expense(10, 'PEN', 'Cable', 'other')), true);
select is(pg_temp.count_of('rober', 'expense_result'), 0, 'registrar un gasto no genera expense_result');

select pg_temp.as_user('jose');
select public.vote_expense(current_setting('t.aprob')::uuid, true);
select public.vote_expense(current_setting('t.rech')::uuid, false);
select pg_temp.as_user('diego');
select public.vote_expense(current_setting('t.aprob')::uuid, true);
select public.vote_expense(current_setting('t.rech')::uuid, false);
select is(pg_temp.count_of('rober', 'expense_result'), 1, 'sin resultado todavia salvo el rechazo (2 votos en contra)');
select pg_temp.as_user('jhony');
select public.vote_expense(current_setting('t.aprob')::uuid, true);
select is(pg_temp.count_of('rober', 'expense_result'), 2, 'el tercer voto a favor aprueba y avisa a quien pago');
select is((select string_agg(payload ->> 'title', '|' order by payload ->> 'title') from public.notifications
  where user_id = pg_temp.uid('rober') and type = 'expense_result'),
  'Tu gasto fue aprobado|Tu gasto fue rechazado', 'un aviso por resultado');

-- Cambios que no tocan el estado no avisan.
select pg_temp.as_user('jhony');
update public.expenses set reimbursed = true where id = current_setting('t.aprob')::uuid;
select is(pg_temp.count_of('rober', 'expense_result'), 2, 'un reembolso no genera otro aviso');
select is(pg_temp.count_of('jhony', 'expense_result'), 0, 'solo quien pago recibe el resultado');

-- Anulacion por quien pago.
select pg_temp.as_user('rober');
update public.expenses set voided_at = now(), void_reason = 'Monto equivocado' where id = current_setting('t.auto')::uuid;
select is(pg_temp.count_of('rober', 'expense_result'), 3, 'anular el gasto avisa una vez');

select * from finish();
rollback;
