-- C25: PARIDAD de las vistas SQL con packages/domain/src/rules.ts.
-- El fixture literal y los numeros esperados son IDENTICOS a los de
-- packages/domain/src/rules.parity.test.ts (Vitest): si cambias uno, cambia el otro.
-- Usuarios: P1 = Jhony (admin, 15 h/sem), P2 = Rober (20), P3 = Jose (15), P4 = Diego (25);
-- C = Alex (colaborador, no entra en el reparto).
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

create function pg_temp.as_user(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-4000-8000-00000000000' ||
    case p_name when 'jhony' then '1' when 'rober' then '2' when 'jose' then '3' when 'diego' then '4'
    when 'alex' then '5' end)::uuid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function pg_temp.as_system() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- fixture determinista
-- Los ayudantes temporales pierden el EXECUTE de PUBLIC por la migración de privilegios por defecto.
grant execute on all functions in schema pg_temp to public;

select pg_temp.as_system();
delete from public.expense_votes;
delete from public.expenses;
delete from public.recurring_expenses;
delete from public.hours_drafts;
delete from public.time_entries;
delete from public.absences;
update public.profiles set weekly_hours = case id
  when '00000000-0000-4000-8000-000000000001' then 15
  when '00000000-0000-4000-8000-000000000002' then 20
  when '00000000-0000-4000-8000-000000000003' then 15
  when '00000000-0000-4000-8000-000000000004' then 25
  else weekly_hours end;
update public.settings set points_per_hour = 20, points_per_sol = 2, min_compliance = 0.8,
  weeks_per_month = 4, expense_approval_limit_pen = 50, entry_edit_days = 7;

insert into public.time_entries (
  user_id, started_at, ended_at, hours, source, segments, paid, validated, validated_at,
  validated_by, draft, voided_at, void_reason, created_at
) values
  -- P1: sin origen, validado, no pagado
  ('00000000-0000-4000-8000-000000000001', '2026-09-05 15:00:00+00', '2026-09-06 01:00:00+00', 10, null, null,
   false, true, '2026-09-30 15:00:00+00', '00000000-0000-4000-8000-000000000002', false, null, null, '2026-09-05 15:00:00+00'),
  -- P1: reloj que cruza el corte de mes en Lima (1 h en septiembre, 2 h en octubre)
  ('00000000-0000-4000-8000-000000000001', '2026-10-01 04:00:00+00', '2026-10-01 07:00:00+00', 3, 'timer',
   '[{"start": "2026-10-01T04:00:00.000Z", "end": "2026-10-01T07:00:00.000Z"}]',
   false, false, null, null, false, null, null, '2026-10-01 04:00:00+00'),
  -- P1: anulado
  ('00000000-0000-4000-8000-000000000001', '2026-09-07 15:00:00+00', '2026-09-08 00:00:00+00', 8, null, null,
   false, false, null, null, false, '2026-09-08 00:00:00+00', 'Error', '2026-09-07 15:00:00+00'),
  -- P2: pagado, pendiente, borrador y dos validados
  ('00000000-0000-4000-8000-000000000002', '2026-09-10 15:00:00+00', '2026-09-11 03:00:00+00', 12, null, null,
   true, true, '2026-09-30 15:00:00+00', '00000000-0000-4000-8000-000000000001', false, null, null, '2026-09-10 15:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', '2026-09-20 15:00:00+00', '2026-09-20 19:00:00+00', 4, null, null,
   false, false, null, null, false, null, null, '2026-09-20 15:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', '2026-09-22 15:00:00+00', '2026-09-22 20:00:00+00', 5, 'timer', null,
   false, false, null, null, true, null, null, '2026-09-22 15:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', '2026-09-25 15:00:00+00', '2026-09-26 15:00:00+00', 24, null, null,
   false, true, '2026-09-30 15:00:00+00', '00000000-0000-4000-8000-000000000001', false, null, null, '2026-09-25 15:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', '2026-09-26 15:00:00+00', '2026-09-27 15:00:00+00', 24, null, null,
   false, true, '2026-09-30 15:00:00+00', '00000000-0000-4000-8000-000000000001', false, null, null, '2026-09-26 15:00:00+00'),
  -- P3: reloj con dos segmentos; 2.5 h confirmadas de 3 h medidas (se prorratea)
  ('00000000-0000-4000-8000-000000000003', '2026-09-12 14:00:00+00', '2026-09-13 15:00:00+00', 2.5, 'timer',
   '[{"start": "2026-09-12T14:00:00.000Z", "end": "2026-09-12T16:00:00.000Z"},
     {"start": "2026-09-13T14:00:00.000Z", "end": "2026-09-13T15:00:00.000Z"}]',
   false, true, '2026-09-30 15:00:00+00', '00000000-0000-4000-8000-000000000001', false, null, null, '2026-09-12 14:00:00+00'),
  -- C: colaborador, validado; no entra en el reparto
  ('00000000-0000-4000-8000-000000000005', '2026-09-15 15:00:00+00', '2026-09-16 07:00:00+00', 40, null, null,
   false, true, '2026-09-30 15:00:00+00', '00000000-0000-4000-8000-000000000001', false, null, null, '2026-09-15 15:00:00+00');

insert into public.expenses (paid_by, amount, currency, concept, category, status, reimbursed, before_signing, voided_at, void_reason) values
  ('00000000-0000-4000-8000-000000000001', 35, 'PEN', 'x1', 'other', 'approved', false, false, null, null),
  ('00000000-0000-4000-8000-000000000001', 120, 'PEN', 'x2 reembolsado', 'other', 'approved', true, false, null, null),
  ('00000000-0000-4000-8000-000000000002', 100, 'PEN', 'x3 previo a la firma', 'other', 'approved', false, true, null, null),
  ('00000000-0000-4000-8000-000000000003', 90, 'PEN', 'x4 pendiente', 'other', 'pending', false, false, null, null),
  ('00000000-0000-4000-8000-000000000004', 13, 'USD', 'x5 en dolares', 'other', 'approved', false, false, null, null),
  ('00000000-0000-4000-8000-000000000004', 80, 'PEN', 'x6', 'other', 'approved', false, false, null, null),
  ('00000000-0000-4000-8000-000000000003', 60, 'PEN', 'x7 anulado', 'other', 'voided', false, false, '2026-09-20 00:00:00+00', 'Error');

insert into public.absences (user_id, from_date, to_date, reason, reduced_hours) values
  ('00000000-0000-4000-8000-000000000003', '2026-09-10', '2026-09-12', 'Viaje', 6),
  ('00000000-0000-4000-8000-000000000003', '2026-10-02', '2026-10-03', 'Tramite', 3);

-- ---------------------------------------------------------------- cumplimiento (septiembre)
select pg_temp.as_user('jhony');

select is((select round(hours, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000001'), 11::numeric, 'P1 septiembre: horas');
select is((select minimum_hours from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000001'), 48::numeric, 'P1 septiembre: minimo');
select is((select round(compliance, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000001'), 0.2292::numeric, 'P1 septiembre: cumplimiento');
select is((select meets_minimum from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000001'), false, 'P1 septiembre: cumple el minimo');
select is((select round(hours, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000002'), 64::numeric, 'P2 septiembre: horas');
select is((select minimum_hours from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000002'), 64::numeric, 'P2 septiembre: minimo');
select is((select round(compliance, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000002'), 1::numeric, 'P2 septiembre: cumplimiento');
select is((select meets_minimum from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000002'), true, 'P2 septiembre: cumple el minimo');
select is((select round(hours, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000003'), 2.5::numeric, 'P3 septiembre: horas');
select is((select minimum_hours from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000003'), 42::numeric, 'P3 septiembre: minimo');
select is((select round(compliance, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000003'), 0.0595::numeric, 'P3 septiembre: cumplimiento');
select is((select meets_minimum from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000003'), false, 'P3 septiembre: cumple el minimo');
select is((select round(hours, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000004'), 0::numeric, 'P4 septiembre: horas');
select is((select minimum_hours from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000004'), 80::numeric, 'P4 septiembre: minimo');
select is((select round(compliance, 4) from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000004'), 0::numeric, 'P4 septiembre: cumplimiento');
select is((select meets_minimum from public.monthly_summary('2026-09') where user_id = '00000000-0000-4000-8000-000000000004'), false, 'P4 septiembre: cumple el minimo');
select is((select count(*)::int from public.monthly_summary('2026-09')), 4, 'solo socios y admin entran en el resumen');
-- octubre: la parte del reloj que cruza el corte y la ausencia de octubre
select is((select round(hours, 4) from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000001'), 2::numeric, 'P1 octubre: horas');
select is((select minimum_hours from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000001'), 48::numeric, 'P1 octubre: minimo');
select is((select round(hours, 4) from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000002'), 0::numeric, 'P2 octubre: horas');
select is((select minimum_hours from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000002'), 64::numeric, 'P2 octubre: minimo');
select is((select round(hours, 4) from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000003'), 0::numeric, 'P3 octubre: horas');
select is((select minimum_hours from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000003'), 45::numeric, 'P3 octubre: minimo');
select is((select round(hours, 4) from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000004'), 0::numeric, 'P4 octubre: horas');
select is((select minimum_hours from public.monthly_summary('2026-10') where user_id = '00000000-0000-4000-8000-000000000004'), 80::numeric, 'P4 octubre: minimo');
-- la vista agrupa por mes desde la primera actividad
select is((select count(*)::int from public.member_monthly_summary where month = '2026-09'), 4, 'la vista mensual lista a los 4 socios');
select is((select round(hours, 4) from public.member_monthly_summary
  where month = '2026-09' and user_id = '00000000-0000-4000-8000-000000000001'), 11::numeric, 'la vista mensual coincide con la funcion');
select throws_like($$select public.monthly_summary('2026-9')$$, 'Mes no valido%', 'el mes se valida');

-- ---------------------------------------------------------------- puntos y participacion

select is((select hour_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000001'), 200::numeric, 'P1: puntos por horas');
select is((select money_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000001'), 70::numeric, 'P1: puntos por dinero');
select is((select total_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000001'), 270::numeric, 'P1: puntos totales');
select is((select round(participation, 4) from public.member_points where user_id = '00000000-0000-4000-8000-000000000001'), 0.1875::numeric, 'P1: participacion');
select is((select hour_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000002'), 960::numeric, 'P2: puntos por horas');
select is((select money_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000002'), 0::numeric, 'P2: puntos por dinero');
select is((select total_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000002'), 960::numeric, 'P2: puntos totales');
select is((select round(participation, 4) from public.member_points where user_id = '00000000-0000-4000-8000-000000000002'), 0.6667::numeric, 'P2: participacion');
select is((select hour_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000003'), 50::numeric, 'P3: puntos por horas');
select is((select money_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000003'), 0::numeric, 'P3: puntos por dinero');
select is((select total_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000003'), 50::numeric, 'P3: puntos totales');
select is((select round(participation, 4) from public.member_points where user_id = '00000000-0000-4000-8000-000000000003'), 0.0347::numeric, 'P3: participacion');
select is((select hour_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000004'), 0::numeric, 'P4: puntos por horas');
select is((select money_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000004'), 160::numeric, 'P4: puntos por dinero');
select is((select total_points from public.member_points where user_id = '00000000-0000-4000-8000-000000000004'), 160::numeric, 'P4: puntos totales');
select is((select round(participation, 4) from public.member_points where user_id = '00000000-0000-4000-8000-000000000004'), 0.1111::numeric, 'P4: participacion');
select is((select count(*)::int from public.member_points), 4, 'el colaborador no entra en el reparto');
select is((select round(sum(participation), 4) from public.member_points), 1::numeric, 'la participacion suma 100 %');

-- ---------------------------------------------------------------- sin acceso para colaboradores
select pg_temp.as_user('alex');
select is((select count(*)::int from public.member_points), 0, 'el colaborador no ve puntos');
select is((select count(*)::int from public.monthly_summary('2026-09')), 0, 'ni el cumplimiento del estudio');
select is((select count(*)::int from public.member_monthly_summary), 0, 'ni la vista mensual');

-- ---------------------------------------------------------------- sin puntos totales: participacion 0
select pg_temp.as_system();
update public.time_entries set validated = false, validated_at = null, validated_by = null;
delete from public.expenses;
select pg_temp.as_user('jhony');
select is((select sum(participation) from public.member_points), 0::numeric, 'sin puntos, la participacion es 0 (no divide por cero)');

reset role;
select * from finish();
rollback;
