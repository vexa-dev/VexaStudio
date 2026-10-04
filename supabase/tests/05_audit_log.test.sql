-- C25: registro de actividad: eventos semanticos, seq sin huecos, cadena de hashes,
-- deteccion de manipulacion, solo-anadir y visibilidad por rol.
begin;
create extension if not exists pgtap with schema extensions;
select plan(97);

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
create function pg_temp.lima_today() returns date language sql stable as $$
  select (now() at time zone 'America/Lima')::date $$;
-- Ultimo seq visible y eventos posteriores (como admin se ve todo).
create function pg_temp.mark() returns bigint language sql stable as $$
  select coalesce(max(seq), 0) from public.audit_log $$;
create function pg_temp.since(p_seq bigint) returns text language sql stable as $$
  select coalesce(string_agg(event_type::text, ',' order by seq), '') from public.audit_log where seq > p_seq $$;

-- ---------------------------------------------------------------- base
select pg_temp.as_system();
select is((select count(*)::int from public.audit_log), 0, 'el seed no deja actividad (como el mock)');
select is((select seq from public.audit_chain_head), 0::bigint, 'la cadena arranca en 0');
select is(public.verify_audit_chain(), null::bigint, 'una cadena vacia es integra');
select is((select count(*)::int from pg_enum where enumtypid = 'public.audit_event_type'::regtype), 26,
  'los 26 tipos de evento de audit.ts');
select is((select count(*)::int from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
    and tablename in ('audit_log', 'tasks', 'time_entries', 'expenses')), 4,
  'Realtime publica audit_log, tasks, time_entries y expenses');

-- ---------------------------------------------------------------- proyecto, miembros y cabeceras
select pg_temp.as_user('jhony');
select set_config('request.headers',
  '{"x-request-id": "req-A", "x-client": "web/1.0.0", "x-client-at": "2026-10-03T10:00:00Z"}', true);
select set_config('t.m0', pg_temp.mark()::text, true);
select set_config('t.proj', (select id::text from public.create_project('Proyecto Audit', 'client', 'active',
  array[pg_temp.uid('rober'), pg_temp.uid('alex')])), true);
select is(pg_temp.since(current_setting('t.m0')::bigint), 'project.created,project.members_changed',
  'crear un proyecto deja project.created y project.members_changed');
select is((select actor_id from public.audit_log where seq = current_setting('t.m0')::bigint + 1),
  pg_temp.uid('jhony'), 'actor = usuario autenticado (no el cliente)');
select is((select actor_role::text from public.audit_log where seq = current_setting('t.m0')::bigint + 1),
  'admin', 'foto del rol del actor en ese momento');
select is((select request_id || '|' || client_platform || '|' || client_version || '|' || session_id
  from public.audit_log where seq = current_setting('t.m0')::bigint + 1),
  'req-A|web|1.0.0|s-jhony', 'cabeceras x-request-id y x-client y session_id del JWT');
select is((select client_at from public.audit_log where seq = current_setting('t.m0')::bigint + 1),
  '2026-10-03 10:00:00+00'::timestamptz, 'x-client-at se guarda aparte');
select ok((select abs(extract(epoch from now() - occurred_at)) < 300 and occurred_at <> client_at
  from public.audit_log where seq = current_setting('t.m0')::bigint + 1),
  'occurred_at es hora del servidor, no la del cliente');
select is((select count(distinct request_id)::int from public.audit_log where seq > current_setting('t.m0')::bigint),
  1, 'una misma operacion comparte request_id');
select is((select entity_table || '|' || entity_label || '|' || (project_id = current_setting('t.proj')::uuid)::text
  from public.audit_log where seq = current_setting('t.m0')::bigint + 1),
  'projects|Proyecto Audit|true', 'tabla, nombre (foto) y proyecto del registro');
select is((select jsonb_array_length(after -> 'memberIds') from public.audit_log
  where seq = current_setting('t.m0')::bigint + 1), 0, 'el snapshot usa las claves del dominio (camelCase)');
select is((select changes -> 0 ->> 'field' from public.audit_log where seq = current_setting('t.m0')::bigint + 2),
  'memberIds', 'los miembros se registran como cambio de memberIds');
select is((select before from public.audit_log where seq = current_setting('t.m0')::bigint + 1),
  null::jsonb, 'una creacion no tiene estado anterior');

-- ---------------------------------------------------------------- sprint y tareas
select set_config('t.m1', pg_temp.mark()::text, true);
select lives_ok($$insert into public.sprints (project_id, start_date, end_date, goal)
  values (current_setting('t.proj')::uuid, '2026-10-05', '2026-10-18', 'Sprint auditado')$$, 'crear sprint');
select is(pg_temp.since(current_setting('t.m1')::bigint), 'sprint.created', 'sprint.created');

select set_config('t.m2', pg_temp.mark()::text, true);
select lives_ok($$insert into public.tasks (title, project_id, assignee_id)
  values ('Tarea auditada', current_setting('t.proj')::uuid, pg_temp.uid('jose'))$$, 'crear tarea');
select set_config('t.task', (select id::text from public.tasks where title = 'Tarea auditada'), true);
select is(pg_temp.since(current_setting('t.m2')::bigint), 'task.created', 'task.created');

select set_config('t.m3', pg_temp.mark()::text, true);
select lives_ok($$update public.tasks set status = 'review' where id = current_setting('t.task')::uuid$$, 'mover');
select is(pg_temp.since(current_setting('t.m3')::bigint), 'task.moved', 'solo cambia status: task.moved');
select set_config('t.m4', pg_temp.mark()::text, true);
select lives_ok($$update public.tasks set assignee_id = pg_temp.uid('diego') where id = current_setting('t.task')::uuid$$, 'asignar');
select is(pg_temp.since(current_setting('t.m4')::bigint), 'task.assigned', 'solo cambia el responsable: task.assigned');
select set_config('t.m5', pg_temp.mark()::text, true);
select lives_ok($$update public.tasks set title = 'Tarea auditada v2', status = 'todo' where id = current_setting('t.task')::uuid$$, 'editar');
select is(pg_temp.since(current_setting('t.m5')::bigint), 'task.edited', 'varios campos: task.edited');
select is((select jsonb_array_length(changes) from public.audit_log where seq = current_setting('t.m5')::bigint + 1), 2,
  'con el diff campo a campo');
select set_config('t.m6', pg_temp.mark()::text, true);
select lives_ok($$update public.tasks set title = title, status = status where id = current_setting('t.task')::uuid$$,
  'una edicion sin cambios');
select is(pg_temp.since(current_setting('t.m6')::bigint), '', 'una edicion sin cambios no deja rastro');
select set_config('t.m7', pg_temp.mark()::text, true);
select lives_ok($$update public.tasks set link = 'https://example.com/pr/1' where id = current_setting('t.task')::uuid$$, 'enlace');
select is((select event_type::text || ':' || (changes -> 0 ->> 'field') from public.audit_log
  where seq = current_setting('t.m7')::bigint + 1), 'task.edited:link', 'un solo campo distinto de status/assignee: task.edited');

-- ---------------------------------------------------------------- etiquetas
select set_config('t.m8', pg_temp.mark()::text, true);
select lives_ok($$insert into public.project_labels (project_id, name, color)
  values (current_setting('t.proj')::uuid, 'Urgente', '#FF0000')$$, 'crear etiqueta');
select set_config('t.label', (select id::text from public.project_labels where name = 'Urgente'), true);
select lives_ok($$update public.project_labels set name = 'Urgente!' where id = current_setting('t.label')::uuid$$, 'renombrar');
select is(pg_temp.since(current_setting('t.m8')::bigint), 'project_label.created,project_label.updated',
  'project_label.created y project_label.updated');
select set_config('t.m9', pg_temp.mark()::text, true);
select lives_ok($$select public.set_task_labels(current_setting('t.task')::uuid, array[current_setting('t.label')::uuid])$$,
  'adjuntar etiqueta');
select is((select event_type::text || ':' || (changes -> 0 ->> 'field') from public.audit_log
  where seq = current_setting('t.m9')::bigint + 1), 'task.edited:labels', 'las etiquetas se registran como task.edited (labels)');
select is((select jsonb_array_length(after -> 'labels') from public.audit_log where seq = current_setting('t.m9')::bigint + 1),
  1, 'con las etiquetas posteriores en el snapshot');
select lives_ok($$select public.set_task_labels(current_setting('t.task')::uuid, '{}')$$, 'quitar etiquetas');
select is(pg_temp.since(current_setting('t.m9')::bigint), 'task.edited,task.edited', 'quitar tambien se registra');

-- ---------------------------------------------------------------- proyecto: edicion y miembros
select set_config('t.m10', pg_temp.mark()::text, true);
select lives_ok($$update public.projects set name = 'Proyecto Audit 2' where id = current_setting('t.proj')::uuid$$, 'renombrar proyecto');
select lives_ok($$select public.set_project_members(current_setting('t.proj')::uuid, array[pg_temp.uid('rober')])$$,
  'quitar un miembro');
select is(pg_temp.since(current_setting('t.m10')::bigint), 'project.updated,project.members_changed',
  'project.updated y project.members_changed');

-- ---------------------------------------------------------------- ajustes y miembros del equipo
select set_config('request.headers', '{"x-request-id": "req-B", "x-client": "weird", "x-client-at": "no es fecha"}', true);
select set_config('t.m11', pg_temp.mark()::text, true);
select lives_ok($$update public.settings set points_per_hour = 25$$, 'cambiar ajustes');
select is((select event_type::text || ':' || (changes -> 0 ->> 'field') || ':' || (changes -> 0 ->> 'from') || '>' || (changes -> 0 ->> 'to')
  from public.audit_log where seq = current_setting('t.m11')::bigint + 1),
  'settings.changed:pointsPerHour:20>25', 'settings.changed con el cambio campo a campo');
select is((select request_id || '|' || client_platform || '|' || coalesce(client_at::text, 'null')
  from public.audit_log where seq = current_setting('t.m11')::bigint + 1),
  'req-B|unknown|null', 'cabeceras invalidas no rompen: plataforma desconocida y client_at nulo');
select set_config('request.headers', '', true);
select set_config('t.m12', pg_temp.mark()::text, true);
select lives_ok($$update public.profiles set weekly_hours = 18 where id = pg_temp.uid('jose')$$, 'editar perfil');
select lives_ok($$update public.profiles set role = 'admin' where id = pg_temp.uid('diego')$$, 'cambiar rol');
select is(pg_temp.since(current_setting('t.m12')::bigint), 'member.updated,member.role_changed',
  'member.updated y member.role_changed');
select isnt((select request_id from public.audit_log where seq = current_setting('t.m12')::bigint + 1), null::text,
  'sin cabeceras el servidor genera un request_id');
select lives_ok($$update public.profiles set role = 'partner' where id = pg_temp.uid('diego')$$, 'devolver el rol');

-- ---------------------------------------------------------------- horas y reloj (varios actores)
select set_config('t.m13', pg_temp.mark()::text, true);
select pg_temp.as_user('jose');
select set_config('t.e1', (select id::text from public.add_manual_hours(
  null, pg_temp.lima_today() - 2, 2, null, 'Trabajo manual A')), true);
select set_config('t.e2', (select id::text from public.add_manual_hours(
  null, pg_temp.lima_today() - 3, 3, null, 'Trabajo manual B')), true);
select lives_ok($$select public.start_timer(null, 'Trabajo con reloj A')$$, 'iniciar reloj');
select lives_ok($$select public.pause_timer()$$, 'pausar');
select lives_ok($$select public.resume_timer()$$, 'continuar');
select lives_ok($$select public.stop_timer()$$, 'finalizar');
select lives_ok($$select public.submit_hours_drafts(
  (select jsonb_build_array(jsonb_build_object('id', d.id, 'hours', 1)) from public.hours_drafts d
   where d.user_id = pg_temp.uid('jose') and d.submitted_at is null), pg_temp.lima_today() - 4)$$, 'confirmar borrador');
select pg_temp.as_user('rober');
select lives_ok($$select public.validate_hours(array[current_setting('t.e1')::uuid])$$, 'aprobar');
select lives_ok($$select public.request_hours_clarification(current_setting('t.e2')::uuid, 'Falta indicar el cliente')$$,
  'pedir aclaracion');
select pg_temp.as_user('jose');
select lives_ok($$select public.update_hours(current_setting('t.e1')::uuid, '{"hours": 2.5}')$$, 'corregir');
select lives_ok($$select public.void_hours(current_setting('t.e1')::uuid, 'Error de carga')$$, 'anular');
select pg_temp.as_user('jhony');
select is(pg_temp.since(current_setting('t.m13')::bigint),
  'hours.created,hours.created,timer.started,timer.paused,timer.resumed,timer.stopped,hours.confirmed,'
  || 'hours.approved,hours.clarification_requested,hours.edited,hours.voided',
  'horas y reloj: la secuencia semantica completa');
select is((select reason from public.audit_log where event_type = 'hours.voided'), 'Error de carga',
  'la anulacion guarda su motivo');
select is((select reason from public.audit_log where event_type = 'hours.clarification_requested'),
  'Falta indicar el cliente', 'la aclaracion guarda su motivo');
select is((select actor_role::text from public.audit_log where event_type = 'hours.approved'), 'partner',
  'el rol del actor es el del momento (socio)');
select is((select (after ->> 'validated')::boolean::text || '>' || (before ->> 'validated') from public.audit_log
  where event_type = 'hours.approved'), 'true>false', 'antes y despues de la aprobacion');

-- ---------------------------------------------------------------- alta de miembro (sistema)
select pg_temp.as_system();
select lives_ok($$insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000aa', 'authenticated',
          'authenticated', 'nuevo@vexa.test', '{"name": "Nuevo Colaborador", "area": "commercial", "weekly_hours": 10}')$$,
  'invitar a un usuario');
select is((select role::text || '|' || area::text || '|' || weekly_hours::text from public.profiles
  where id = '00000000-0000-4000-8000-0000000000aa'), 'collaborator|commercial|10.00',
  'el perfil nace colaborador con los metadatos de la invitacion');
select is((select event_type::text || '|' || coalesce(actor_id::text, 'sistema') || '|' || client_platform
  from public.audit_log where event_type = 'member.created'), 'member.created|sistema|system',
  'member.created sin usuario: actor del sistema');

select lives_ok($$update public.profiles set active = false where id = '00000000-0000-4000-8000-0000000000aa'$$,
  'desactivar al usuario invitado');
select is((select event_type::text from public.audit_log order by seq desc limit 1), 'member.deactivated',
  'member.deactivated');

-- ---------------------------------------------------------------- visibilidad por rol
select pg_temp.as_user('alex');
select lives_ok($$update public.tasks set status = 'in_progress' where id = '30000000-0000-4000-8000-000000000012'$$,
  'Alex mueve su tarea');
select is((select count(*)::int from public.audit_log), 1, 'el colaborador solo ve sus propias acciones');
select is((select event_type::text from public.audit_log), 'task.moved', 'su propia accion');
select pg_temp.as_user('jose');
select is((select count(*)::int from public.audit_log where project_id = current_setting('t.proj')::uuid), 0,
  'un socio no ve proyectos de los que no es miembro');
select ok((select count(*) from public.audit_log where actor_id = pg_temp.uid('jose')) > 0, 'pero si sus propias acciones');
select ok((select count(*) from public.audit_log where actor_id = pg_temp.uid('alex')) = 1,
  'y las acciones de otros en sus proyectos (Alex mueve una tarea de Vexa Studio)');
select pg_temp.as_user('rober');
select ok((select count(*) from public.audit_log where project_id = current_setting('t.proj')::uuid) > 0,
  'un socio miembro ve los eventos del proyecto');
select pg_temp.as_system();
select set_config('t.exp', (select count(*)::text from public.audit_log a where a.actor_id = pg_temp.uid('rober')
  or a.project_id in (select project_id from public.project_members where user_id = pg_temp.uid('rober'))), true);
select pg_temp.as_user('rober');
select is((select count(*)::int from public.audit_log), current_setting('t.exp')::int,
  'el socio ve exactamente: sus acciones y los proyectos donde es miembro');
select pg_temp.as_user('jhony');
select is((select count(*)::int from public.audit_log), (select seq::int from public.audit_log order by seq desc limit 1),
  'el admin ve todo (y la numeracion no tiene huecos)');
select is((select count(distinct event_type)::int from public.audit_log), 25,
  'se produjeron los 25 tipos de evento alcanzables (todos menos timer.recovered)');

-- ---------------------------------------------------------------- solo anadir
select throws_like($$update public.audit_log set reason = 'x'$$, 'permission denied%', 'el admin no edita entradas');
select throws_like($$delete from public.audit_log$$, 'permission denied%', 'el admin no borra entradas');
select throws_like($$truncate public.audit_log$$, 'permission denied%', 'ni vacia el registro');
select throws_like($$insert into public.audit_log (seq, occurred_at, event_type, entity_table, entity_id,
    entity_label, request_id, client_platform, client_version, prev_hash, hash)
  values (9999, now(), 'task.created', 'tasks', 'x', 'x', 'x', 'web', '1', 'x', 'x')$$,
  'permission denied%', 'nadie inserta a mano');
select throws_like($$select * from public.audit_chain_head$$, 'permission denied%', 'la cabeza de la cadena es interna');
select pg_temp.as_system();
select throws_like($$update public.audit_log set reason = 'x'$$, 'El registro de actividad es de solo lectura%',
  'ni el dueno de la tabla edita entradas (trigger)');
select throws_like($$delete from public.audit_log$$, 'El registro de actividad es de solo lectura%', 'ni borra (trigger)');
select throws_like($$truncate public.audit_log$$, 'El registro de actividad es de solo lectura%', 'ni vacia (trigger)');

-- ---------------------------------------------------------------- seq sin huecos ni con rollback
select is((select count(*)::int from public.audit_log), (select max(seq)::int from public.audit_log),
  'seq consecutivo desde 1');
select is((select min(seq) from public.audit_log), 1::bigint, 'y empieza en 1');
select is((select seq from public.audit_chain_head), (select max(seq) from public.audit_log), 'la cabeza apunta al ultimo');
select set_config('t.h0', (select seq::text from public.audit_chain_head), true);
savepoint intento;
update public.settings set points_per_hour = 30;
rollback to savepoint intento;
update public.settings set points_per_hour = 31;
select is((select max(seq) from public.audit_log), current_setting('t.h0')::bigint + 1,
  'un rollback no deja huecos en seq');

-- ---------------------------------------------------------------- cadena de hashes
select pg_temp.as_user('rober');
select throws_like($$select public.verify_audit_chain()$$, 'Solo un administrador verifica la cadena%',
  'solo admin verifica la cadena');
select pg_temp.as_user('jhony');
select is(public.verify_audit_chain(), null::bigint, 'la cadena integra devuelve NULL');
select pg_temp.as_system();
select is((select prev_hash from public.audit_log where seq = 1), repeat('0', 64), 'la cadena parte de un hash cero');
select is((select a.prev_hash from public.audit_log a where a.seq = 5), (select b.hash from public.audit_log b where b.seq = 4),
  'cada entrada encadena el hash de la anterior');
-- Manipulacion: se salta el trigger solo para simular a un atacante con acceso a la base.
alter table public.audit_log disable trigger audit_log_no_update_delete;
update public.audit_log set reason = 'manipulado' where seq = 3;
alter table public.audit_log enable trigger audit_log_no_update_delete;
select is(public.verify_audit_chain(), 3::bigint, 'verify_audit_chain detecta una entrada alterada (primer seq roto)');
alter table public.audit_log disable trigger audit_log_no_update_delete;
update public.audit_log set reason = null where seq = 3;
delete from public.audit_log where seq = 6;
alter table public.audit_log enable trigger audit_log_no_update_delete;
select is(public.verify_audit_chain(), 6::bigint, 'detecta una entrada borrada (hueco en seq)');

reset role;
select * from finish();
rollback;
