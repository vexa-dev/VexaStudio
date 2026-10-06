-- C25: reloj unico, borradores, registro manual, revision sin autoaprobacion, ventana de
-- edicion y anulacion con motivo. Se ejecuta sobre el seed (Jose = 3, Rober = 2, Alex = 5).
begin;
create extension if not exists pgtap with schema extensions;
select plan(78);

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
-- Mantenimiento (rol postgres, sin usuario): sin JWT, auth.uid() es NULL.
create function pg_temp.as_system() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.lima_today() returns date language sql stable as $$
  select (now() at time zone 'America/Lima')::date $$;

-- ---------------------------------------------------------------- reloj unico
-- Los ayudantes temporales pierden el EXECUTE de PUBLIC por la migración de privilegios por defecto.
grant execute on all functions in schema pg_temp to public;

select pg_temp.as_user('jose');
select lives_ok($$select public.start_timer('30000000-0000-4000-8000-000000000009')$$,
  'iniciar el reloj en una tarea propia');
select is((select count(*)::int from public.time_entries
  where user_id = pg_temp.uid('jose') and ended_at is null and voided_at is null), 1, 'hay un reloj abierto');
select is((select status::text from public.tasks where id = '30000000-0000-4000-8000-000000000009'),
  'in_progress', 'la tarea pasa a En progreso al iniciar el reloj');
select throws_like($$select public.start_timer('30000000-0000-4000-8000-000000000005')$$,
  'Solo puedes trabajar en tus tareas asignadas%', 'no se inicia el reloj en tareas ajenas');
select throws_like($$select public.start_timer(null, 'corto')$$,
  'Describe el trabajo que vas a realizar%', 'sin tarea hace falta una descripcion');
select throws_like($$insert into public.time_entries
    (user_id, started_at, source, timer_state, segment_started_at, segments)
    values (pg_temp.uid('jose'), now(), 'timer', 'running', now(), '[]')$$,
  '%one_open_timer%', 'el indice unico impide un segundo reloj abierto por usuario');

select is((select timer_state from public.pause_timer()), 'paused', 'pausar el reloj');
select is((select jsonb_array_length(segments) from public.time_entries
  where user_id = pg_temp.uid('jose') and ended_at is null), 1, 'la pausa cierra un segmento');
select is((select timer_state from public.resume_timer()), 'running', 'continuar el reloj');
select lives_ok($$select public.stop_timer()$$, 'finalizar el reloj');
select is((select count(*)::int from public.time_entries
  where user_id = pg_temp.uid('jose') and ended_at is null and voided_at is null), 0, 'ya no hay reloj abierto');
select is((select count(*)::int from public.time_entries
  where user_id = pg_temp.uid('jose') and task_id = '30000000-0000-4000-8000-000000000009' and draft
    and timer_state is null and ended_at is not null), 1, 'la sesion cerrada queda como borrador');
select is((select count(*)::int from public.hours_drafts
  where user_id = pg_temp.uid('jose') and task_id = '30000000-0000-4000-8000-000000000009'
    and submitted_at is null and measured and cardinality(entry_ids) = 1), 1,
  'el borrador de horas recoge la sesion medida');

-- Iniciar uno nuevo detiene el anterior.
select lives_ok($$select public.start_timer(null, 'Trabajo libre de preparacion')$$, 'reloj sin tarea');
select lives_ok($$select public.start_timer('30000000-0000-4000-8000-000000000009')$$,
  'iniciar otro detiene el abierto');
select is((select count(*)::int from public.time_entries
  where user_id = pg_temp.uid('jose') and ended_at is null and voided_at is null), 1,
  'sigue habiendo un solo reloj abierto');
select is((select count(*)::int from public.hours_drafts
  where user_id = pg_temp.uid('jose') and submitted_at is null), 2,
  'el reloj detenido por el nuevo queda en su propio borrador');

-- Un reloj abierto es de su dueno: otro usuario no lo cierra por la ruta interna.
select pg_temp.as_system();
select set_config('t.open', (select id::text from public.time_entries
  where user_id = '00000000-0000-4000-8000-000000000003' and ended_at is null), true);
select pg_temp.as_user('rober');
select throws_like($$select private.close_timer_entry(current_setting('t.open')::uuid, now())$$,
  'Solo puedes cerrar tu propio reloj%', 'nadie cierra el reloj ajeno');
select is((select count(*)::int from public.time_entries
  where user_id = pg_temp.uid('jose') and draft), 0, 'los borradores de reloj no son visibles para otros');

-- ---------------------------------------------------------------- confirmar borradores
select pg_temp.as_user('jose');
select set_config('t.draft', (select id::text from public.hours_drafts
  where user_id = pg_temp.uid('jose') and task_id = '30000000-0000-4000-8000-000000000009'
    and submitted_at is null), true);
select throws_like($$select public.submit_hours_drafts(
    jsonb_build_array(jsonb_build_object('id', current_setting('t.draft'), 'hours', 30)), pg_temp.lima_today())$$,
  'Las horas deben estar entre 0 y 24%', 'maximo 24 horas');
select throws_like($$select public.submit_hours_drafts(
    jsonb_build_array(jsonb_build_object('id', current_setting('t.draft'), 'hours', 1)), pg_temp.lima_today() + 1)$$,
  'Fecha no valida%', 'no se confirma en fecha futura');
select throws_like($$select public.submit_hours_drafts(
    jsonb_build_array(jsonb_build_object('id', current_setting('t.draft'), 'hours', 1),
                      jsonb_build_object('id', current_setting('t.draft'), 'hours', 1)), pg_temp.lima_today())$$,
  'Selecciona tareas distintas%', 'no se repite un borrador');
select lives_ok($$select public.submit_hours_drafts(
    jsonb_build_array(jsonb_build_object('id', current_setting('t.draft'), 'hours', 1.5)),
    pg_temp.lima_today() - 3, 'Confirmo la semana')$$, 'confirmar un borrador');
select is((select hours::numeric from public.time_entries
  where user_id = pg_temp.uid('jose') and allocations is not null and not draft), 1.5::numeric,
  'el registro confirmado suma las horas elegidas');
select is((select jsonb_array_length(allocations) from public.time_entries
  where user_id = pg_temp.uid('jose') and allocations is not null and not draft), 1,
  'con una asignacion por tarea');
select is((select validated from public.time_entries
  where user_id = pg_temp.uid('jose') and allocations is not null and not draft), false,
  'queda pendiente de revision (sin aprobacion automatica)');
select throws_like($$select public.submit_hours_drafts(
    jsonb_build_array(jsonb_build_object('id', current_setting('t.draft'), 'hours', 1.5)), pg_temp.lima_today())$$,
  'El borrador ya no esta disponible%', 'no hay doble envio');

-- ---------------------------------------------------------------- registro manual
select throws_like($$select public.add_manual_hours(null, pg_temp.lima_today() - 1, 25, null, 'Reunion con prospecto')$$,
  'Las horas deben estar entre 0 y 24%', 'manual: maximo 24 horas');
select throws_like($$select public.add_manual_hours(null, pg_temp.lima_today() + 1, 2, null, 'Reunion con prospecto')$$,
  'No puedes registrar horas en una fecha futura%', 'manual: no hay fechas futuras');
select throws_like($$select public.add_manual_hours('30000000-0000-4000-8000-000000000005', pg_temp.lima_today() - 1, 2)$$,
  'Solo puedes trabajar en tus tareas asignadas%', 'manual: solo tareas propias');
select throws_like($$select public.add_manual_hours(null, pg_temp.lima_today() - 1, 2, null, 'corto')$$,
  'Describe el trabajo realizado%', 'manual: sin tarea hace falta descripcion');
select lives_ok($$select public.add_manual_hours(null, pg_temp.lima_today() - 1, 1, null,
    'Reunion con prospecto', null, '09:00')$$, 'registro manual con hora de inicio');
select throws_like($$select public.add_manual_hours(null, pg_temp.lima_today() - 1, 1, null,
    'Otra reunion distinta', null, '09:30')$$,
  'Este horario se superpone%', 'manual: no se superponen horarios');
select set_config('t.e1', (select id::text from public.add_manual_hours(
  null, pg_temp.lima_today() - 2, 2, null, 'Trabajo manual de uno')), true);
select set_config('t.e2', (select id::text from public.add_manual_hours(
  null, pg_temp.lima_today() - 3, 3, null, 'Trabajo manual de dos')), true);
select set_config('t.e3', (select id::text from public.add_manual_hours(
  null, pg_temp.lima_today() - 4, 4, null, 'Trabajo manual de tres')), true);

-- ---------------------------------------------------------------- revision sin autoaprobacion
select throws_like($$select public.validate_hours(array[current_setting('t.e2')::uuid])$$,
  'No puedes aprobar tus propias horas%', 'sin autoaprobacion (RPC)');
select throws_like($$update public.time_entries set validated = true where id = current_setting('t.e2')::uuid$$,
  'No puedes modificar la revision%', 'sin autoaprobacion (UPDATE directo)');
select throws_like($$update public.time_entries set paid = true where id = current_setting('t.e2')::uuid$$,
  'El pago no se registra desde aqui%', 'nadie se marca pagado');
select pg_temp.as_user('alex');
select throws_like($$select public.validate_hours(array[current_setting('t.e2')::uuid])$$,
  'Tu rol no permite esta accion%', 'un colaborador no revisa');
select pg_temp.as_user('rober');
select throws_like($$update public.time_entries set hours = 9 where id = current_setting('t.e2')::uuid$$,
  'Solo puedes aprobar o pedir aclaracion%', 'el revisor no edita horas ajenas');
select throws_like($$select public.request_hours_clarification(current_setting('t.e2')::uuid, 'corto')$$,
  'Explica que necesita aclaracion%', 'la aclaracion necesita explicacion');
select lives_ok($$select public.request_hours_clarification(current_setting('t.e2')::uuid,
    'Falta indicar el cliente')$$, 'pedir aclaracion');
select is((select reviewed_by from public.time_entries where id = current_setting('t.e2')::uuid),
  pg_temp.uid('rober'), 'la aclaracion registra quien la pidio');
select lives_ok($$select public.validate_hours(array[current_setting('t.e1')::uuid, current_setting('t.e3')::uuid])$$,
  'aprobar en grupo');
select is((select validated_by from public.time_entries where id = current_setting('t.e1')::uuid),
  pg_temp.uid('rober'), 'se registra el aprobador');
select isnt((select validated_at from public.time_entries where id = current_setting('t.e1')::uuid),
  null::timestamptz, 'y la fecha de aprobacion (hora del servidor)');
select throws_like($$select public.validate_hours(array[current_setting('t.e1')::uuid])$$,
  'El registro ya esta aprobado%', 'no se aprueba dos veces');
select is((select count(*)::int from public.time_entries where user_id = pg_temp.uid('jose') and not draft
  and validated and paid is false and created_at > now() - interval '1 hour'), 2,
  'las horas aprobadas cuentan para puntos (validadas y no pagadas)');

-- ---------------------------------------------------------------- ventana de edicion y correcciones
select pg_temp.as_user('jose');
select throws_like($$select public.update_hours(current_setting('t.e3')::uuid, '{"hours": 99}')$$,
  'Las horas deben estar entre 0 y 24%', 'editar: maximo 24 horas');
select lives_ok($$select public.update_hours(current_setting('t.e1')::uuid, '{"hours": 2.5}')$$,
  'corregir una aprobacion dentro de la ventana');
select is((select validated from public.time_entries where id = current_setting('t.e1')::uuid), false,
  'la correccion devuelve el registro a pendiente');
select is((select validated_by from public.time_entries where id = current_setting('t.e1')::uuid),
  null::uuid, 'y retira al aprobador (y sus puntos)');
select is((select hours::numeric from public.time_entries where id = current_setting('t.e1')::uuid), 2.5::numeric,
  'con las horas corregidas');

select pg_temp.as_system();
-- Fuera de la ventana de 7 dias solo se edita con una aclaracion pendiente.
update public.time_entries set created_at = now() - interval '30 days'
  where id = current_setting('t.e2')::uuid;
select pg_temp.as_user('jose');
select lives_ok($$select public.update_hours(current_setting('t.e2')::uuid, '{"hours": 3.5}')$$,
  'una aclaracion habilita corregir fuera de la ventana');
select is((select review_note from public.time_entries where id = current_setting('t.e2')::uuid), null::text,
  'al corregir se limpia la aclaracion');
select throws_like($$select public.update_hours(current_setting('t.e2')::uuid, '{"hours": 3}')$$,
  'Este registro ya no se puede editar%', 'sin aclaracion y fuera de la ventana no se edita');
select throws_like($$update public.time_entries set hours = 1 where id = current_setting('t.e2')::uuid$$,
  'Este registro ya no se puede editar%', 'tampoco por UPDATE directo');
select pg_temp.as_user('diego');
select throws_like($$select public.update_hours(
    (select id from public.time_entries where user_id = pg_temp.uid('diego') and paid limit 1), '{"hours": 2}')$$,
  'Este registro ya no se puede editar%', 'un registro pagado esta bloqueado');

-- ---------------------------------------------------------------- anulacion con motivo
select pg_temp.as_user('jose');
select throws_like($$select public.void_hours(current_setting('t.e3')::uuid, 'Error de carga')$$,
  'No se puede anular un registro validado%', 'no se anula lo validado');
select throws_like($$select public.void_hours(current_setting('t.e1')::uuid, 'x')$$,
  'Escribe el motivo de la anulacion%', 'la anulacion exige motivo');
select pg_temp.as_user('rober');
select throws_like($$select public.void_hours(current_setting('t.e1')::uuid, 'Error de carga')$$,
  'Solo puedes modificar tus propios registros%', 'nadie anula horas ajenas');
select pg_temp.as_user('jose');
select lives_ok($$select public.void_hours(current_setting('t.e1')::uuid, 'Error de carga')$$, 'anular con motivo');
select is((select void_reason from public.time_entries where id = current_setting('t.e1')::uuid),
  'Error de carga', 'se guarda el motivo');
select isnt((select voided_at from public.time_entries where id = current_setting('t.e1')::uuid),
  null::timestamptz, 'y la fecha de anulacion');
select throws_like($$select public.void_hours(current_setting('t.e1')::uuid, 'Otra vez')$$,
  'El registro ya esta anulado%', 'no se anula dos veces');
select throws_like($$delete from public.time_entries$$, 'permission denied%', 'nadie borra horas');
select pg_temp.as_user('rober');
select throws_like($$select public.validate_hours(array[current_setting('t.e1')::uuid])$$,
  'Solo se revisan registros finalizados y vigentes%', 'lo anulado no se revisa');

-- ---------------------------------------------------------------- finalizar tarea: borrador de horas
select pg_temp.as_user('rober');
select lives_ok($$select public.start_timer('30000000-0000-4000-8000-000000000005')$$, 'Rober inicia su reloj');
select lives_ok($$select public.stop_timer()$$, 'y lo detiene');
select lives_ok($$select public.start_timer('30000000-0000-4000-8000-000000000005')$$, 'lo inicia de nuevo');
select lives_ok($$select public.move_task('30000000-0000-4000-8000-000000000005', 'done')$$,
  'finalizar la tarea cierra el reloj abierto');
select is((select count(*)::int from public.time_entries
  where user_id = pg_temp.uid('rober') and ended_at is null and voided_at is null), 0, 'sin reloj abierto');
select is((select count(*)::int from public.hours_drafts
  where user_id = pg_temp.uid('rober') and task_id = '30000000-0000-4000-8000-000000000005'
    and submitted_at is null and measured and cardinality(entry_ids) = 2), 1,
  'las sesiones se acumulan en un solo borrador pendiente');
select lives_ok($$select public.move_task('30000000-0000-4000-8000-000000000005', 'review')$$, 'reabrir la tarea');
select lives_ok($$select public.move_task('30000000-0000-4000-8000-000000000005', 'done')$$, 'terminarla otra vez');
select is((select count(*)::int from public.hours_drafts
  where user_id = pg_temp.uid('rober') and task_id = '30000000-0000-4000-8000-000000000005'
    and submitted_at is null), 1, 'no se duplica el borrador al reabrir y terminar');

-- El admin finaliza la tarea de otra persona: el borrador es de la persona responsable.
select pg_temp.as_user('jhony');
select lives_ok($$select public.move_task('30000000-0000-4000-8000-000000000008', 'done')$$,
  'el admin finaliza una tarea ajena');
select pg_temp.as_system();
select is((select hours::numeric from public.hours_drafts
  where user_id = '00000000-0000-4000-8000-000000000003' and task_id = '30000000-0000-4000-8000-000000000008'
    and submitted_at is null and not measured), 6::numeric,
  'el borrador usa la estimacion como sugerencia');

-- ---------------------------------------------------------------- colaborador
select pg_temp.as_user('alex');
select lives_ok($$select public.start_timer('30000000-0000-4000-8000-000000000012')$$,
  'el colaborador registra horas en su tarea');
select is((select count(*)::int from public.time_entries), 1, 'y solo ve sus propias horas');

reset role;
select * from finish();
rollback;
