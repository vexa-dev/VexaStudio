-- C28: notificaciones en la app (B4). Solo los triggers las crean; cada persona lee y marca las
-- suyas; el cliente no inserta, no borra y solo cambia `read_at`. Ids del seed: 1 Jhony (admin),
-- 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(75);

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
-- Filas afectadas por una DML con el rol actual.
create function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;
-- Cantidad de avisos de un tipo para una persona (se cuenta como sistema, sin RLS).
create function pg_temp.count_of(p_name text, p_type text) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.as_system();
  select count(*)::int into n from public.notifications
  where user_id = pg_temp.uid(p_name) and type::text = p_type;
  return n;
end $$;
grant execute on all functions in schema pg_temp to public;

-- ---------------------------------------------------------------- estructura
select pg_temp.as_system();
select has_table('public', 'notifications', 'existe la tabla notifications');
select enum_has_labels('public', 'notification_type', array[
  'project_added', 'task_assigned', 'daily_pending', 'hours_missing', 'expense_vote',
  'expense_result', 'mention', 'renewal', 'meeting'], 'el enum refleja los tipos del dominio');
select is((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), true,
  'notifications tiene RLS');
select is((select count(*)::int from pg_trigger
  where tgrelid = 'public.notifications'::regclass and tgname like 'audit%' and not tgisinternal), 0,
  'las notificaciones son derivadas: no llevan trigger de auditoria');
select is((select count(*)::int from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'), 1,
  'Realtime publica notifications');

-- ---------------------------------------------------------------- privilegios
select ok(not has_table_privilege('anon', 'public.notifications', 'select')
  and not has_table_privilege('anon', 'public.notifications', 'insert')
  and not has_table_privilege('anon', 'public.notifications', 'update')
  and not has_table_privilege('anon', 'public.notifications', 'delete'), 'anon no tiene acceso');
select ok(has_table_privilege('authenticated', 'public.notifications', 'select')
  and not has_table_privilege('authenticated', 'public.notifications', 'insert')
  and not has_table_privilege('authenticated', 'public.notifications', 'update')
  and not has_table_privilege('authenticated', 'public.notifications', 'delete'),
  'authenticated solo lee a nivel de tabla');
select ok(has_column_privilege('authenticated', 'public.notifications', 'read_at', 'update')
  and not has_column_privilege('authenticated', 'public.notifications', 'payload', 'update')
  and not has_column_privilege('authenticated', 'public.notifications', 'user_id', 'update')
  and not has_column_privilege('authenticated', 'public.notifications', 'type', 'update'),
  'authenticated solo actualiza la columna read_at');
select ok(not has_function_privilege('anon', 'public.mark_all_notifications_read()', 'execute')
  and has_function_privilege('authenticated', 'public.mark_all_notifications_read()', 'execute')
  and not has_function_privilege('anon', 'public.mark_notification_read(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.mark_notification_read(uuid)', 'execute'),
  'los RPC de lectura solo los ejecuta authenticated');
select ok(not has_function_privilege('authenticated', 'private.notify(uuid, public.notification_type, jsonb)', 'execute')
  and not has_function_privilege('anon', 'private.notify(uuid, public.notification_type, jsonb)', 'execute'),
  'private.notify no es ejecutable por los clientes');

-- ---------------------------------------------------------------- datos de base (via notify)
select pg_temp.as_system();
select ok(private.notify(pg_temp.uid('rober'), 'mention', '{"title":"Uno"}') is not null, 'notify crea un aviso');
select ok(private.notify(pg_temp.uid('rober'), 'mention', '{"title":"Dos"}') is not null, 'notify crea otro aviso');
select ok(private.notify(pg_temp.uid('alex'), 'mention', '{"title":"Para Alex"}') is not null, 'notify crea un aviso ajeno');
select is(private.notify(null, 'mention', '{"title":"Nadie"}'), null, 'notify ignora destinatario nulo');

-- ---------------------------------------------------------------- lectura propia
select pg_temp.as_user('rober');
select is((select count(*)::int from public.notifications), 2, 'Rober ve solo sus 2 avisos');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('alex')), 0,
  'Rober no ve los de Alex');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.notifications), 1, 'Alex ve solo su aviso');
select pg_temp.as_user('jose');
select is((select count(*)::int from public.notifications), 0, 'Jose no ve ningun aviso ajeno');
select pg_temp.as_anon();
select throws_like($$select count(*) from public.notifications$$, 'permission denied%', 'anon no lee');

-- Un perfil inactivo ya no ve nada (ni recibe avisos nuevos).
select pg_temp.as_system();
update public.profiles set active = false where id = pg_temp.uid('alex');
select is(private.notify(pg_temp.uid('alex'), 'mention', '{"title":"A inactivo"}'), null,
  'notify ignora a una persona inactiva');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.notifications), 0, 'un perfil inactivo no ve avisos');
select pg_temp.as_system();
update public.profiles set active = true where id = pg_temp.uid('alex');
select is(pg_temp.count_of('alex', 'mention'), 1, 'el inactivo no recibio el aviso nuevo');

-- ---------------------------------------------------------------- escritura del cliente
select pg_temp.as_user('rober');
select throws_like($$insert into public.notifications (user_id, type) values (pg_temp.uid('rober'), 'mention')$$,
  'permission denied%', 'el cliente no inserta');
select throws_like($$delete from public.notifications$$, 'permission denied%', 'el cliente no borra');
select throws_like($$update public.notifications set payload = '{"x":"y"}'$$,
  'permission denied%', 'el cliente no cambia el contenido');
select throws_like($$update public.notifications set user_id = pg_temp.uid('alex')$$,
  'permission denied%', 'el cliente no reasigna un aviso');
select is(pg_temp.affected($$update public.notifications set read_at = now()
  where user_id = pg_temp.uid('alex')$$), 0, 'no marca como leido el aviso ajeno');
select is(pg_temp.affected($$update public.notifications set read_at = now()
  where payload->>'title' = 'Uno'$$), 1, 'marca como leido su propio aviso');
select is((select count(*)::int from public.notifications where read_at is not null), 1,
  'el aviso propio queda leido');
select throws_like($$update public.notifications set read_at = null where payload->>'title' = 'Uno'$$,
  '%ya fue revisada%', 'un aviso leido no vuelve a pendiente');
select throws_like($$update public.notifications set read_at = now() + interval '1 day'
  where payload->>'title' = 'Dos'$$, '%futuro%', 'read_at no puede ser futuro');
-- El guarda frena cambios de contenido incluso para quien ignora los privilegios.
select pg_temp.as_system();
select throws_like($$update public.notifications set payload = '{"x":"y"}'$$,
  '%solo puede cambiar read_at%', 'el guarda bloquea cambios de contenido');
select throws_like($$update public.notifications set type = 'meeting'$$,
  '%solo puede cambiar read_at%', 'el guarda bloquea cambios de tipo');

-- ---------------------------------------------------------------- RPC de lectura
select pg_temp.as_user('rober');
select is(public.mark_notification_read((select id from public.notifications where payload->>'title' = 'Dos')),
  true, 'mark_notification_read marca un aviso propio');
select is(public.mark_notification_read((select id from public.notifications where payload->>'title' = 'Dos')),
  false, 'repetir la marca no cambia nada');
select pg_temp.as_system();
select ok(private.notify(pg_temp.uid('rober'), 'meeting', '{"title":"Tres"}') is not null, 'aviso nuevo para Rober');
select ok(private.notify(pg_temp.uid('rober'), 'meeting', '{"title":"Cuatro"}') is not null, 'otro aviso nuevo para Rober');
select pg_temp.as_user('rober');
select is(public.mark_notification_read((select id from public.notifications where payload->>'title' = 'Tres')),
  true, 'marca un aviso nuevo');
select pg_temp.as_user('jose');
select is(public.mark_notification_read((select id from public.notifications where payload->>'title' = 'Cuatro')),
  false, 'Jose no puede marcar el aviso de otra persona (no lo ve)');
select is(public.mark_notification_read(gen_random_uuid()), false, 'un id inexistente devuelve false');
select pg_temp.as_user('rober');
select is(public.mark_all_notifications_read(), 1, 'mark_all marca solo los pendientes propios y devuelve la cantidad');
select is((select count(*)::int from public.notifications where read_at is null), 0, 'Rober ya no tiene pendientes');
select is(public.mark_all_notifications_read(), 0, 'sin pendientes devuelve 0');
select pg_temp.as_system();
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('alex') and read_at is null), 1,
  'mark_all de Rober no toco a Alex');
select pg_temp.as_anon();
select throws_like($$select public.mark_all_notifications_read()$$, 'permission denied%', 'anon no ejecuta mark_all');

-- ---------------------------------------------------------------- tope de carga y tipo valido
select pg_temp.as_system();
select throws_like($$select private.notify(pg_temp.uid('rober'), 'mention', jsonb_build_object('title', repeat('x', 3000)))$$,
  '%notifications_payload_size_check%', 'la carga tiene un tope de tamano');
select throws_ok($$select private.notify(pg_temp.uid('rober'), 'inventado', '{}')$$, '22P02', null,
  'el tipo debe pertenecer al enum');

-- ---------------------------------------------------------------- (a) proyecto: anadido a un proyecto
select pg_temp.as_system();
insert into public.projects (name, type) values ('Proyecto de avisos', 'client');
select set_config('t.proj', (select id::text from public.projects where name = 'Proyecto de avisos'), true);
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.project_members (project_id, user_id)
  values (current_setting('t.proj')::uuid, pg_temp.uid('alex'))$$, 'el admin agrega a Alex');
select is(pg_temp.count_of('alex', 'project_added'), 1, 'Alex recibe project_added');
select is((select payload->>'projectId' || '|' || (payload->>'projectName') || '|' || (payload->>'actorName')
  from public.notifications where user_id = pg_temp.uid('alex') and type = 'project_added'),
  current_setting('t.proj') || '|Proyecto de avisos|Jhony Rivera', 'la carga trae proyecto y autor');
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.project_members (project_id, user_id)
  values (current_setting('t.proj')::uuid, pg_temp.uid('jhony'))$$, 'el admin se agrega a si mismo');
select is(pg_temp.count_of('jhony', 'project_added'), 0, 'nadie se avisa a si mismo');

-- ---------------------------------------------------------------- (b) tareas asignadas
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.tasks (title, project_id, assignee_id)
  values ('Revisar contrato', current_setting('t.proj')::uuid, pg_temp.uid('diego'))$$, 'el admin crea y asigna');
select is(pg_temp.count_of('diego', 'task_assigned'), 1, 'Diego recibe task_assigned');
select is((select payload->>'taskName' || '|' || (payload->>'projectName') || '|' || (payload->>'actorName')
    || '|' || ((payload->>'taskId')::uuid = (select id from public.tasks where title = 'Revisar contrato'))::text
  from public.notifications where user_id = pg_temp.uid('diego') and type = 'task_assigned'),
  'Revisar contrato|Proyecto de avisos|Jhony Rivera|true', 'la carga trae tarea, proyecto y autor');
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.tasks (title, project_id, assignee_id)
  values ('Tarea propia', current_setting('t.proj')::uuid, pg_temp.uid('jhony'))$$, 'el admin se asigna a si mismo');
select lives_ok($$insert into public.tasks (title, project_id) values ('Sin responsable', current_setting('t.proj')::uuid)$$,
  'tarea sin responsable');
select is(pg_temp.count_of('jhony', 'task_assigned'), 0, 'asignarse no avisa');
select pg_temp.as_user('jhony');
select lives_ok($$update public.tasks set assignee_id = pg_temp.uid('rober') where title = 'Sin responsable'$$,
  'asignar despues');
select is(pg_temp.count_of('rober', 'task_assigned'), 1, 'Rober recibe el aviso al asignarle');
select pg_temp.as_user('jhony');
select lives_ok($$update public.tasks set title = 'Sin responsable v2', status = 'in_progress'
  where title = 'Sin responsable'$$, 'editar sin cambiar responsable');
select is(pg_temp.count_of('rober', 'task_assigned'), 1, 'editar la tarea no repite el aviso');
select pg_temp.as_user('jhony');
select lives_ok($$update public.tasks set assignee_id = null where title = 'Sin responsable v2'$$, 'quitar responsable');
select pg_temp.as_system();
select is((select count(*)::int from public.notifications where type = 'task_assigned'), 2,
  'quitar al responsable no crea avisos');
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.tasks (title, project_id, assignee_id)
  values (repeat('T', 600), current_setting('t.proj')::uuid, pg_temp.uid('jose'))$$,
  'un titulo larguisimo no rompe la creacion de la tarea');
select is(pg_temp.count_of('jose', 'task_assigned'), 1, 'el aviso del titulo largo se recorta y se crea');

-- ---------------------------------------------------------------- (c) gastos por votar
select pg_temp.as_user('rober');
select lives_ok($$insert into public.expenses (paid_by, amount, concept, category)
  values (pg_temp.uid('rober'), 500, 'Servidor dedicado', 'infrastructure')$$, 'Rober registra un gasto grande');
select is(pg_temp.count_of('jhony', 'expense_vote') + pg_temp.count_of('jose', 'expense_vote')
  + pg_temp.count_of('diego', 'expense_vote'), 3, 'admin y los otros socios reciben expense_vote');
select is(pg_temp.count_of('rober', 'expense_vote') + pg_temp.count_of('alex', 'expense_vote'), 0,
  'ni quien pago ni el colaborador reciben el aviso');
select is((select payload->>'expenseTitle' || '|' || (payload->>'amount') || '|' || (payload->>'actorName')
    || '|' || ((payload->>'expenseId')::uuid = (select id from public.expenses where concept = 'Servidor dedicado'))::text
  from public.notifications where user_id = pg_temp.uid('jhony') and type = 'expense_vote'),
  'Servidor dedicado|S/ 500.00|Rober Vasquez|true', 'la carga trae gasto, monto y autor');
select pg_temp.as_user('rober');
select lives_ok($$insert into public.expenses (paid_by, amount, concept, category)
  values (pg_temp.uid('rober'), 10, 'Cafe', 'other')$$, 'Rober registra un gasto chico');
select pg_temp.as_system();
select is((select count(*)::int from public.notifications where type = 'expense_vote'), 3,
  'un gasto aprobado automaticamente no pide votos');
update public.profiles set active = false where id = pg_temp.uid('jose');
select pg_temp.as_user('diego');
select lives_ok($$insert into public.expenses (paid_by, amount, concept, category)
  values (pg_temp.uid('diego'), 300, 'Licencia', 'software')$$, 'Diego registra otro gasto grande');
select is(pg_temp.count_of('jose', 'expense_vote'), 1, 'un socio inactivo no recibe avisos nuevos');
select is(pg_temp.count_of('jhony', 'expense_vote') + pg_temp.count_of('rober', 'expense_vote'), 3,
  'los socios activos si (Jhony 2 y Rober 1)');

select * from finish();
rollback;
