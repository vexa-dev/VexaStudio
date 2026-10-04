-- C25: gastos (auto-aprobacion hasta el limite, 3 votos a favor), anulacion con motivo,
-- reembolsos, recurrentes y bucket privado de comprobantes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

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
create function pg_temp.as_system() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;

-- ---------------------------------------------------------------- limite de aprobacion
select pg_temp.as_user('rober');
select set_config('t.x50', (select id::text from public.create_expense(50, 'PEN', 'Dominio extra', 'infrastructure')), true);
select set_config('t.x51', (select id::text from public.create_expense(50.01, 'PEN', 'Licencia', 'software')), true);
select set_config('t.xusd', (select id::text from public.create_expense(10, 'USD', 'Servicio en dolares', 'software')), true);
select is((select status::text from public.expenses where id = current_setting('t.x50')::uuid), 'approved',
  'hasta S/ 50 se aprueba solo');
select is((select status::text from public.expenses where id = current_setting('t.x51')::uuid), 'pending',
  'sobre S/ 50 queda pendiente');
select is((select status::text from public.expenses where id = current_setting('t.xusd')::uuid), 'pending',
  'un gasto en dolares siempre pasa por votacion');
select is((select paid_by from public.expenses where id = current_setting('t.x50')::uuid), pg_temp.uid('rober'),
  'el gasto queda a nombre de quien lo registra');

-- El cliente no decide el estado ni el reembolso.
select lives_ok($$insert into public.expenses (paid_by, amount, concept, category, status, reimbursed)
    values (pg_temp.uid('rober'), 500, 'Intento de autoaprobacion', 'other', 'approved', true)$$,
  'insertar un gasto grande con estado forzado');
select is((select status::text || ':' || reimbursed::text from public.expenses
  where concept = 'Intento de autoaprobacion'), 'pending:false', 'el servidor impone estado pendiente y sin reembolso');
select throws_like($$insert into public.expenses (paid_by, amount, concept)
    values (pg_temp.uid('jose'), 10, 'A nombre de otro')$$,
  'Solo puedes registrar gastos pagados por ti%', 'no se registra a nombre de otro socio');
select throws_like($$update public.expenses set amount = 1 where id = current_setting('t.x50')::uuid$$,
  'Un gasto registrado no se edita%', 'un gasto no se edita');
select throws_like($$update public.expenses set status = 'approved' where id = current_setting('t.x51')::uuid$$,
  'El estado del gasto lo define la votacion%', 'el estado no se cambia a mano');
select throws_like($$delete from public.expenses$$, 'permission denied%', 'nadie borra gastos');

-- ---------------------------------------------------------------- votos
select pg_temp.as_user('alex');
select throws_like($$select public.vote_expense(current_setting('t.x51')::uuid, true)$$,
  'Este gasto ya no admite votos%', 'un colaborador no vota (no ve los gastos)');
select pg_temp.as_user('rober');
select lives_ok($$select public.vote_expense(current_setting('t.x51')::uuid, true)$$, 'un socio vota');
select throws_like($$select public.vote_expense(current_setting('t.x51')::uuid, false)$$,
  '%duplicate key%', 'un voto por socio');
select throws_like($$select public.vote_expense(current_setting('t.x50')::uuid, true)$$,
  'Este gasto ya no admite votos%', 'un gasto aprobado no admite votos');
select pg_temp.as_user('jose');
select lives_ok($$select public.vote_expense(current_setting('t.x51')::uuid, true)$$, 'segundo voto a favor');
select is((select status::text from public.expenses where id = current_setting('t.x51')::uuid), 'pending',
  'con 2 votos a favor sigue pendiente');
select pg_temp.as_user('diego');
select lives_ok($$select public.vote_expense(current_setting('t.x51')::uuid, true)$$, 'tercer voto a favor');
select is((select status::text from public.expenses where id = current_setting('t.x51')::uuid), 'approved',
  'con 3 votos a favor se aprueba');
select throws_like($$select public.vote_expense(current_setting('t.x51')::uuid, true)$$,
  'Este gasto ya no admite votos%', 'resuelto el gasto, se cierra la votacion');

-- Rechazo: con 4 votantes y 3 requeridos, 2 en contra lo rechazan.
select pg_temp.as_user('jhony');
select set_config('t.xno', (select id::text from public.create_expense(80, 'PEN', 'Gasto discutido', 'marketing')), true);
select lives_ok($$select public.vote_expense(current_setting('t.xno')::uuid, false)$$, 'primer voto en contra');
select is((select status::text from public.expenses where id = current_setting('t.xno')::uuid), 'pending',
  'un voto en contra aun deja pendiente');
select pg_temp.as_user('rober');
select lives_ok($$select public.vote_expense(current_setting('t.xno')::uuid, false)$$, 'segundo voto en contra');
select is((select status::text from public.expenses where id = current_setting('t.xno')::uuid), 'rejected',
  'con 2 en contra ya no se alcanzan 3 a favor: rechazado');
select is((select count(*)::int from public.expense_votes where expense_id = current_setting('t.xno')::uuid), 2,
  'los votos quedan registrados');

-- ---------------------------------------------------------------- anulacion y reembolso
select pg_temp.as_user('jose');
select throws_like($$select public.void_expense(current_setting('t.x50')::uuid, 'Error')$$,
  'El gasto no existe o no tienes permiso%', 'solo quien pago anula');
select pg_temp.as_user('jhony');
select throws_like($$select public.void_expense(current_setting('t.x50')::uuid, 'Error')$$,
  'Solo quien pago el gasto puede anularlo%', 'ni el admin anula gastos ajenos');
select lives_ok($$select public.void_expense(current_setting('t.xno')::uuid, 'Duplicado')$$,
  'quien pago anula con motivo');
select is((select status::text from public.expenses where id = current_setting('t.xno')::uuid), 'voided',
  'el gasto queda anulado');
select isnt((select voided_at from public.expenses where id = current_setting('t.xno')::uuid), null::timestamptz,
  'con fecha del servidor');
select throws_like($$select public.void_expense(current_setting('t.xno')::uuid, 'Otra vez')$$,
  'El gasto ya esta anulado%', 'no se anula dos veces');
select pg_temp.as_user('rober');
select throws_like($$select public.void_expense(current_setting('t.x51')::uuid, 'x')$$,
  'Escribe el motivo de la anulacion%', 'la anulacion exige motivo');
select throws_like($$update public.expenses set reimbursed = true where id = current_setting('t.x50')::uuid$$,
  'Solo un administrador registra reembolsos%', 'un socio no marca reembolsos');
select pg_temp.as_user('jhony');
select is(pg_temp.affected($$update public.expenses set reimbursed = true where id = current_setting('t.x50')::uuid$$),
  1, 'el admin registra reembolsos');

-- ---------------------------------------------------------------- puntos por gastos (vista)
select is((select money_points::numeric from public.member_points where user_id = pg_temp.uid('rober')),
  (35 + 50.01) * 2, 'rober: S/ 35 y S/ 50.01 aprobados suman; S/ 50 reembolsado y los pendientes no');
select is((select money_points::numeric from public.member_points where user_id = pg_temp.uid('diego')),
  0::numeric, 'diego: reembolsado, pendiente y en dolares no suman');

-- ---------------------------------------------------------------- recurrentes y comprobantes
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.recurring_expenses (concept, amount, currency, next_date, periodicity)
    values ('Hosting', 20, 'USD', '2027-01-15', 'monthly')$$, 'el admin crea recurrentes');
select is((select count(*)::int from public.recurring_expenses), 2, 'se leen los recurrentes');
select pg_temp.as_system();
select is((select public from storage.buckets where id = 'receipts'), false, 'el bucket de comprobantes es privado');
select is((select count(*)::int from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'receipts_%'), 2,
  'solo hay politicas de lectura y subida (nadie borra ni reemplaza)');

reset role;
select * from finish();
rollback;
