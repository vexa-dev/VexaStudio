-- Cerrar sprint (M5): solo el admin, en una transaccion, con validacion en bloque que bloquea las horas,
-- reporte de entrega guardado y tareas sin terminar al backlog.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

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
create function pg_temp.id(p_n int) returns uuid language sql immutable as $$
  select ('90000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid $$;
grant execute on function pg_temp.uid(text), pg_temp.as_user(text), pg_temp.as_system(), pg_temp.id(int)
  to authenticated, anon;

-- Datos propios (el seed no se toca): proyecto 1 con sprint activo (S1) y un sprint planificado (S2).
-- Tareas S1: T1 hecha (Rober, 4 h), T2 en curso (Jose, 3 h), T3 hecha (Diego, sin estimar).
-- Horas: E1 Rober/T1 2 h, E2 Jose/T2 1 h, E3 Diego/T3 3 h etiquetando a Jhony, E4 Jhony/T1 1 h (propia),
-- E5 Rober en una tarea de S2, E6 Rober agrupada (T1 0,5 h + T2 1 h).
select pg_temp.as_system();
insert into public.projects (id, name, type, status) values (pg_temp.id(1), 'Cierre', 'internal', 'active');
insert into public.sprints (id, project_id, start_date, end_date, goal) values
  (pg_temp.id(10), pg_temp.id(1), '2026-10-01', '2026-10-14', 'Sprint a cerrar'),
  (pg_temp.id(11), pg_temp.id(1), '2026-10-15', '2026-10-28', 'Sprint siguiente');
insert into public.tasks (id, sprint_id, project_id, title, status, assignee_id, estimate_hours) values
  (pg_temp.id(20), pg_temp.id(10), pg_temp.id(1), 'T1', 'done', pg_temp.uid('rober'), 4),
  (pg_temp.id(21), pg_temp.id(10), pg_temp.id(1), 'T2', 'in_progress', pg_temp.uid('jose'), 3),
  (pg_temp.id(22), pg_temp.id(10), pg_temp.id(1), 'T3', 'done', pg_temp.uid('diego'), null),
  (pg_temp.id(23), pg_temp.id(11), pg_temp.id(1), 'T4', 'todo', pg_temp.uid('rober'), 2);
insert into public.time_entries (id, user_id, task_id, project_id, description, started_at, ended_at, hours, allocations) values
  (pg_temp.id(30), pg_temp.uid('rober'), pg_temp.id(20), pg_temp.id(1), 'E1 trabajo de prueba',
    '2026-10-02 15:00+00', '2026-10-02 17:00+00', 2, null),
  (pg_temp.id(31), pg_temp.uid('jose'), pg_temp.id(21), pg_temp.id(1), 'E2 trabajo de prueba',
    '2026-10-03 15:00+00', '2026-10-03 16:00+00', 1, null),
  (pg_temp.id(32), pg_temp.uid('diego'), pg_temp.id(22), pg_temp.id(1), 'E3 trabajo de prueba',
    '2026-10-04 15:00+00', '2026-10-04 18:00+00', 3, null),
  (pg_temp.id(33), pg_temp.uid('jhony'), pg_temp.id(20), pg_temp.id(1), 'E4 trabajo de prueba',
    '2026-10-05 15:00+00', '2026-10-05 16:00+00', 1, null),
  (pg_temp.id(34), pg_temp.uid('rober'), pg_temp.id(23), pg_temp.id(1), 'E5 trabajo de prueba',
    '2026-10-06 15:00+00', '2026-10-06 17:00+00', 2, null),
  (pg_temp.id(35), pg_temp.uid('rober'), null, pg_temp.id(1), 'E6 trabajo agrupado',
    '2026-10-07 15:00+00', '2026-10-07 16:30+00', 1.5,
    jsonb_build_array(
      jsonb_build_object('taskId', pg_temp.id(20), 'title', 'T1', 'projectId', pg_temp.id(1), 'hours', 0.5),
      jsonb_build_object('taskId', pg_temp.id(21), 'title', 'T2', 'projectId', pg_temp.id(1), 'hours', 1)));
insert into public.time_entry_participants (entry_id, user_id, share_percent)
  values (pg_temp.id(32), pg_temp.uid('jhony'), 50);

select is((select status::text from public.sprints where id = pg_temp.id(10)), 'active', 'el sprint de prueba nace activo');
select is((select status::text from public.sprints where id = pg_temp.id(11)), 'planned', 'el siguiente nace planificado');

-- ================================================================ permisos y reglas
select pg_temp.as_user('rober');
select throws_ok($$select public.close_sprint(pg_temp.id(10), '{}')$$, '42501',
  'Solo un administrador puede cerrar un sprint', 'un socio no cierra el sprint');
select pg_temp.as_user('alex');
select throws_ok($$select public.close_sprint(pg_temp.id(10), '{}')$$, '42501',
  'Solo un administrador puede cerrar un sprint', 'un colaborador no cierra el sprint');

select pg_temp.as_user('jhony');
select throws_ok($$select public.close_sprint(pg_temp.id(10), array[pg_temp.id(33)])$$, 'P0001',
  'No puedes aprobar tus propias horas', 'no se validan las horas propias');
select throws_ok($$select public.close_sprint(pg_temp.id(10), array[pg_temp.id(32)])$$, 'P0001',
  'No puedes aprobar horas en las que estas etiquetado', 'no se validan las horas donde estas etiquetado');
select throws_ok($$select public.close_sprint(pg_temp.id(10), array[pg_temp.id(34)])$$, 'P0001',
  'El registro no pertenece a este sprint', 'no se validan horas de otro sprint');
select throws_ok($$select public.close_sprint(pg_temp.id(10), array[pg_temp.id(99)])$$, 'P0001',
  'Solo se validan registros finalizados y vigentes', 'un registro inexistente se rechaza');
select throws_ok($$select public.close_sprint(pg_temp.id(11), '{}')$$, 'P0001',
  'Solo se puede cerrar un sprint activo', 'un sprint planificado no se cierra');
select throws_ok($$select public.close_sprint(pg_temp.id(98), '{}')$$, 'P0001',
  'El sprint no existe', 'un sprint inexistente se rechaza');

-- Atomicidad: un id invalido deshace todo, incluso lo que era valido.
select throws_ok($$select public.close_sprint(pg_temp.id(10), array[pg_temp.id(30), pg_temp.id(34)])$$, 'P0001',
  'El registro no pertenece a este sprint', 'un id invalido aborta el cierre');
select is((select validated from public.time_entries where id = pg_temp.id(30)), false,
  'atomicidad: la hora valida no quedo validada');
select is((select status::text from public.sprints where id = pg_temp.id(10)), 'active', 'atomicidad: el sprint sigue activo');
select is((select sprint_id from public.tasks where id = pg_temp.id(21)), pg_temp.id(10),
  'atomicidad: la tarea sin terminar sigue en el sprint');

-- ================================================================ cierre
select lives_ok($$select public.close_sprint(pg_temp.id(10), array[pg_temp.id(30), pg_temp.id(31), pg_temp.id(35), pg_temp.id(30)])$$,
  'el admin cierra el sprint validando horas elegidas (ids repetidos se ignoran)');
select is((select status::text from public.sprints where id = pg_temp.id(10)), 'closed', 'el sprint queda cerrado');
select is((select closed_by from public.sprints where id = pg_temp.id(10)), pg_temp.uid('jhony'), 'closed_by es quien cerro');
select ok((select closed_at is not null from public.sprints where id = pg_temp.id(10)), 'closed_at queda fijado');
select is((select count(*)::int from public.time_entries where locked_by_sprint = pg_temp.id(10) and validated
  and validated_by = pg_temp.uid('jhony') and validated_at is not null), 3,
  'las 3 horas elegidas quedan validadas por el admin y bloqueadas');
select is((select validated from public.time_entries where id = pg_temp.id(32)), false, 'lo no elegido sigue pendiente');
select is((select locked_by_sprint from public.time_entries where id = pg_temp.id(32)), null, 'lo no elegido no se bloquea');

-- Tareas: lo no terminado vuelve al backlog; lo hecho se queda en el sprint cerrado.
select is((select sprint_id from public.tasks where id = pg_temp.id(21)), null, 'la tarea sin terminar va al backlog');
select is((select sprint_id from public.tasks where id = pg_temp.id(20)), pg_temp.id(10), 'la tarea hecha se queda en el sprint');
select is((select sprint_id from public.tasks where id = pg_temp.id(23)), pg_temp.id(11), 'las tareas de otro sprint no se tocan');

-- Reporte de entrega persistido.
select is((select p -> 'committed' from public.sprints s, jsonb_array_elements(s.close_report -> 'partners') p
  where s.id = pg_temp.id(10) and p ->> 'userId' = pg_temp.uid('rober')::text), '1'::jsonb, 'rober: 1 comprometida');
select is((select p -> 'delivered' from public.sprints s, jsonb_array_elements(s.close_report -> 'partners') p
  where s.id = pg_temp.id(10) and p ->> 'userId' = pg_temp.uid('rober')::text), '1'::jsonb, 'rober: 1 entregada');
select is((select (p ->> 'loggedHours')::numeric from public.sprints s, jsonb_array_elements(s.close_report -> 'partners') p
  where s.id = pg_temp.id(10) and p ->> 'userId' = pg_temp.uid('rober')::text), 3.5,
  'rober: horas registradas = 2 (E1) + 1,5 (E6 agrupada en T1 y T2); E5 es de otro sprint');
select is((select (p ->> 'delivered')::int from public.sprints s, jsonb_array_elements(s.close_report -> 'partners') p
  where s.id = pg_temp.id(10) and p ->> 'userId' = pg_temp.uid('jose')::text), 0, 'jose: nada entregado');
select is((select (select count(*)::int from jsonb_array_elements_text(close_report -> 'pendingEntryIds'))
  from public.sprints where id = pg_temp.id(10)), 2, 'el reporte lista las 2 horas pendientes (E3 y E4)');

-- Bloqueo: el dueno ya no edita ni anula, ni cambia etiquetas.
select pg_temp.as_user('rober');
select throws_ok($$update public.time_entries set description = 'editado despues del cierre' where id = pg_temp.id(30)$$,
  '42501', 'Este registro quedo bloqueado por el cierre de sprint', 'el dueno no edita una hora validada en el cierre');
select throws_ok($$select public.update_hours(pg_temp.id(30), '{"description":"editado despues del cierre"}'::jsonb)$$,
  '42501', null, 'tampoco por la RPC de edicion');
select throws_ok($$update public.time_entries set locked_by_sprint = null where id = pg_temp.id(30)$$,
  '42501', 'Este registro quedo bloqueado por el cierre de sprint', 'no se desbloquea desde el cliente');
select throws_ok($$select public.set_hours_participants(pg_temp.id(30), '[{"userId":"00000000-0000-4000-8000-000000000003","sharePercent":50}]'::jsonb)$$,
  '42501', null, 'tampoco se etiqueta a alguien en una hora bloqueada');

-- Cerrado una vez, no se cierra dos veces; y el audit conserva las aprobaciones del cierre.
select pg_temp.as_user('jhony');
select throws_ok($$select public.close_sprint(pg_temp.id(10), '{}')$$, 'P0001',
  'Solo se puede cerrar un sprint activo', 'un sprint cerrado no se cierra otra vez');
select is((select count(*)::int from public.audit_log where event_type = 'hours.approved'
  and entity_id = pg_temp.id(30)::text), 1, 'la aprobacion del cierre queda en el registro de actividad');

select * from finish();
rollback;
