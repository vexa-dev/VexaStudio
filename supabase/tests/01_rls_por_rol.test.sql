-- C25: RLS por rol (admin / socio / colaborador / anon) sobre los datos del seed.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(72);

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
-- Filas afectadas por una sentencia DML, ejecutada con el rol actual.
create function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;

-- ---------------------------------------------------------------- anon: nada
-- Los ayudantes temporales pierden el EXECUTE de PUBLIC por la migración de privilegios por defecto.
grant execute on all functions in schema pg_temp to public;

select pg_temp.as_anon();
select throws_like('select * from public.profiles', 'permission denied%', 'anon no lee perfiles');
select throws_like('select * from public.tasks', 'permission denied%', 'anon no lee tareas');
select throws_like('select * from public.time_entries', 'permission denied%', 'anon no lee horas');
select throws_like('select * from public.audit_log', 'permission denied%', 'anon no lee el registro');
select throws_like('select * from public.member_points', 'permission denied%', 'anon no lee puntos');

-- ---------------------------------------------------------------- perfiles y ajustes
select pg_temp.as_user('alex');
select is((select count(*)::int from public.profiles), 5, 'el colaborador ve el equipo');
select is((select count(*)::int from public.settings), 1, 'ajustes legibles por cualquier usuario');
select is(pg_temp.affected($$update public.profiles set role = 'admin' where id = pg_temp.uid('alex')$$),
  0, 'el colaborador no se promueve');
select is(pg_temp.affected($$update public.settings set points_per_hour = 99$$),
  0, 'el colaborador no cambia ajustes');

select pg_temp.as_user('rober');
select is((select count(*)::int from public.profiles), 5, 'el socio ve el equipo');
select is(pg_temp.affected($$update public.profiles set weekly_hours = 1 where id = pg_temp.uid('rober')$$),
  0, 'el socio no edita perfiles');
select is(pg_temp.affected($$update public.settings set points_per_hour = 99$$),
  0, 'el socio no cambia ajustes');

select pg_temp.as_user('jhony');
select is(pg_temp.affected($$update public.settings set points_per_hour = 21$$), 1, 'el admin cambia ajustes');
select is((select points_per_hour::int from public.settings), 21, 'el cambio de ajustes se aplico');
select is(pg_temp.affected($$update public.profiles set weekly_hours = 16 where id = pg_temp.uid('jose')$$),
  1, 'el admin edita perfiles');

-- ---------------------------------------------------------------- proyectos y miembros
select pg_temp.as_user('alex');
select is((select count(*)::int from public.projects), 1, 'el colaborador solo ve su proyecto');
select is((select count(*)::int from public.project_members), 5, 'el colaborador ve el equipo de su proyecto');
select throws_like($$insert into public.projects (name, type) values ('X', 'internal')$$,
  'new row violates row-level security%', 'el colaborador no crea proyectos');

select pg_temp.as_user('rober');
select is((select count(*)::int from public.projects), 3, 'el socio ve sus tres proyectos');
select throws_like($$insert into public.projects (name, type) values ('X', 'internal')$$,
  'new row violates row-level security%', 'el socio no crea proyectos');
select throws_like(
  $$insert into public.project_members (project_id, user_id)
    values ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005')$$,
  'new row violates row-level security%', 'el socio no gestiona miembros');
select is(pg_temp.affected($$update public.projects set name = 'Hack'$$), 0, 'el socio no edita proyectos');

select pg_temp.as_user('jhony');
select is((select count(*)::int from public.projects), 3, 'el admin ve todos los proyectos');
select lives_ok($$insert into public.projects (name, type) values ('Nuevo', 'client')$$, 'el admin crea proyectos');
select lives_ok(
  $$insert into public.project_members (project_id, user_id)
    select id, pg_temp.uid('alex') from public.projects where name = 'Nuevo'$$,
  'el admin agrega miembros');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.projects), 2, 'el colaborador ve el proyecto al que lo agregaron');
select pg_temp.as_user('jhony');
select is(pg_temp.affected($$delete from public.project_members where project_id =
    (select id from public.projects where name = 'Nuevo')$$), 1, 'el admin quita miembros');
select throws_like($$delete from public.projects$$, 'permission denied%', 'nadie borra proyectos');

-- ---------------------------------------------------------------- tareas
select pg_temp.as_user('jhony');
select is((select count(*)::int from public.tasks), 14, 'el admin ve todas las tareas');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.tasks), 13, 'el socio ve las tareas de sus proyectos');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.tasks), 12,
  'el colaborador ve las propias y las de proyectos donde es miembro');

-- Escritura de tareas
select pg_temp.as_user('rober');
select throws_like($$insert into public.tasks (title, project_id) values ('X', '10000000-0000-4000-8000-000000000001')$$,
  'new row violates row-level security%', 'el socio no crea tareas');
select is(pg_temp.affected($$update public.tasks set status = 'review'
    where id = '30000000-0000-4000-8000-000000000005'$$), 1, 'el socio mueve su tarea');
select throws_like($$update public.tasks set title = 'Otro'
    where id = '30000000-0000-4000-8000-000000000005'$$,
  'Solo el administrador edita%', 'el socio no edita el contenido de su tarea');
select throws_like($$update public.tasks set assignee_id = null
    where id = '30000000-0000-4000-8000-000000000005'$$,
  'Solo el administrador edita%', 'el socio no reasigna');
select is(pg_temp.affected($$update public.tasks set status = 'done'
    where id = '30000000-0000-4000-8000-000000000008'$$), 0, 'el socio no mueve la tarea de otro');

select pg_temp.as_user('alex');
select is(pg_temp.affected($$update public.tasks set status = 'in_progress'
    where id = '30000000-0000-4000-8000-000000000012'$$), 1, 'el colaborador mueve su tarea');
select is(pg_temp.affected($$update public.tasks set status = 'done'
    where id = '30000000-0000-4000-8000-000000000005'$$), 0, 'el colaborador no mueve tareas ajenas');
select throws_like($$delete from public.tasks$$, 'permission denied%', 'nadie borra tareas');

select pg_temp.as_user('jhony');
select lives_ok($$insert into public.tasks (title, project_id, sprint_id, assignee_id)
    values ('Tarea admin', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003')$$, 'el admin crea y asigna tareas');
select throws_like($$insert into public.tasks (title, project_id, sprint_id)
    values ('Mal sprint', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002')$$,
  '%violates foreign key%', 'el sprint debe pertenecer al proyecto de la tarea');

-- ---------------------------------------------------------------- etiquetas
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.project_labels (project_id, name, color)
    values ('10000000-0000-4000-8000-000000000001', '  Bug  ', '#FF0000'),
           ('10000000-0000-4000-8000-000000000001', 'Diseno', '#00ff00')$$, 'el admin crea etiquetas');
select is((select name || ' ' || color from public.project_labels where lower(name) = 'bug'),
  'Bug #ff0000', 'nombre y color se guardan canonicos');
select throws_like($$insert into public.project_labels (project_id, name, color)
    values ('10000000-0000-4000-8000-000000000001', 'bug', '#000000')$$,
  '%duplicate key%', 'sin etiquetas duplicadas por proyecto');
select is((select count(*)::int from public.project_labels), 2, 'el admin ve el catalogo');
select lives_ok($$insert into public.task_labels (task_id, label_id)
    select '30000000-0000-4000-8000-000000000012', id from public.project_labels where name = 'Bug'$$,
  'el admin adjunta una etiqueta');
select throws_like($$insert into public.task_labels (task_id, label_id)
    select '30000000-0000-4000-8000-000000000013', id from public.project_labels where name = 'Bug'$$,
  'Las etiquetas deben pertenecer al proyecto de la tarea%', 'la etiqueta debe ser del proyecto de la tarea');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.project_labels), 1,
  'el colaborador solo recibe las etiquetas adjuntas a sus tareas, sin catalogo');
select is((select count(*)::int from public.task_labels), 1, 'el colaborador ve las etiquetas de sus tareas');
select throws_like($$insert into public.project_labels (project_id, name, color)
    values ('10000000-0000-4000-8000-000000000001', 'Mia', '#000000')$$,
  'new row violates row-level security%', 'el colaborador no crea etiquetas');

-- ---------------------------------------------------------------- sprints
select pg_temp.as_user('alex');
select is((select count(*)::int from public.sprints), 2, 'el colaborador ve los sprints de su proyecto');
select throws_like($$insert into public.sprints (project_id, start_date, end_date, goal)
    values ('10000000-0000-4000-8000-000000000001', '2026-10-10', '2026-10-20', 'X')$$,
  'new row violates row-level security%', 'el colaborador no crea sprints');
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.sprints (project_id, start_date, end_date, goal)
    values ('10000000-0000-4000-8000-000000000001', '2026-10-10', '2026-10-20', 'Siguiente')$$,
  'el admin crea sprints');
select is((select status::text from public.sprints where goal = 'Siguiente'), 'planned',
  'un segundo sprint nace planificado');
select throws_like($$update public.sprints set status = 'active' where goal = 'Siguiente'$$,
  '%duplicate key%', 'un solo sprint activo por proyecto');

-- ---------------------------------------------------------------- horas entre usuarios
select pg_temp.as_user('alex');
select is((select count(*)::int from public.time_entries), 0, 'el colaborador solo ve sus horas (ninguna)');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.time_entries), 72, 'el socio ve las horas del equipo para revisarlas');
select throws_like($$insert into public.time_entries (user_id, started_at, ended_at, hours)
    values (pg_temp.uid('jose'), '2026-10-01 15:00+00', '2026-10-01 16:00+00', 1)$$,
  'Solo puedes registrar tus propias horas%', 'nadie registra horas a nombre de otro');
select throws_like($$update public.time_entries set hours = 1
    where user_id = pg_temp.uid('jose')$$,
  'Solo puedes aprobar o pedir aclaracion%', 'un socio no edita horas ajenas: solo revisa');
select pg_temp.as_user('alex');
select is(pg_temp.affected($$update public.time_entries set hours = 1
    where user_id = pg_temp.uid('jose')$$), 0, 'el colaborador no toca horas ajenas');

-- ---------------------------------------------------------------- gastos y recurrentes
select pg_temp.as_user('alex');
select is((select count(*)::int from public.expenses), 0, 'el colaborador no ve gastos');
select is((select count(*)::int from public.recurring_expenses), 0, 'el colaborador no ve recurrentes');
select is((select count(*)::int from public.expense_votes), 0, 'el colaborador no ve votos');
select throws_like($$insert into public.expenses (paid_by, amount, concept)
    values (pg_temp.uid('alex'), 10, 'X')$$,
  'new row violates row-level security%', 'el colaborador no registra gastos');
select pg_temp.as_user('diego');
select is((select count(*)::int from public.expenses), 6, 'el socio ve los gastos');
select is((select count(*)::int from public.recurring_expenses), 1, 'el socio ve los recurrentes');
select throws_like($$insert into public.recurring_expenses (concept, amount, next_date, periodicity)
    values ('X', 1, '2027-01-01', 'monthly')$$,
  'new row violates row-level security%', 'el socio no crea recurrentes');

-- ---------------------------------------------------------------- ausencias
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.absences (user_id, from_date, to_date, reason, reduced_hours)
    values (pg_temp.uid('rober'), '2026-10-12', '2026-10-14', 'Viaje', 6)$$, 'el admin registra ausencias');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.absences), 0, 'el colaborador no ve ausencias ajenas');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.absences), 1, 'el socio ve las ausencias');

-- ---------------------------------------------------------------- borradores propios
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.hours_drafts (user_id, title, draft_date)
    values (pg_temp.uid('jhony'), 'Mio', '2026-10-03')$$, 'cada quien crea sus borradores');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.hours_drafts), 0, 'los borradores son privados');

reset role;
select * from finish();
rollback;
