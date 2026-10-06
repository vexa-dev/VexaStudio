-- C30: configuracion del perfil. Usuario unico (sin distinguir mayusculas) y con formato, bio de
-- hasta 280, edicion solo del perfil propio y sin columnas privilegiadas, preferencias de
-- notificacion propias, anon bloqueado y el aviso de tarea asignada respeta la preferencia.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

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
create function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;
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
select has_column('public', 'profiles', 'username', 'profiles tiene username');
select has_column('public', 'profiles', 'bio', 'profiles tiene bio');
select has_table('public', 'notification_preferences', 'existe notification_preferences');
select is((select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass), true,
  'notification_preferences tiene RLS');
select is((select username from public.profiles where id = pg_temp.uid('rober')), null,
  'el usuario nace vacio hasta que la persona lo elige');

-- ---------------------------------------------------------------- datos personales propios
select pg_temp.as_user('rober');
select is((select (public.update_my_profile('Rober V.', '  Rober.V_1 ', 'Lider tecnico')).username),
  'rober.v_1', 'el usuario se normaliza a minusculas y sin espacios');
select is((select name || '|' || coalesce(username, '') || '|' || coalesce(bio, '') from public.profiles
  where id = pg_temp.uid('rober')), 'Rober V.|rober.v_1|Lider tecnico', 'se guardan nombre, usuario y bio');
select is((select role::text || '|' || weekly_hours::text from public.profiles where id = pg_temp.uid('rober')),
  'partner|20.00', 'el rol y las horas no cambian');
select lives_ok($$select public.update_my_profile('Rober V.', 'rober.v_1', 'otra bio')$$,
  'repetir el mismo usuario propio no choca consigo mismo');
select is((select (public.update_my_profile('Rober V.', '', '   ')).username), null,
  'usuario vacio se guarda como nulo');
select is((select bio from public.profiles where id = pg_temp.uid('rober')), null,
  'bio en blanco se guarda como nula');
select lives_ok($$select public.update_my_profile('Rober V.', 'rober.v_1', repeat('a', 280))$$,
  'bio de 280 caracteres cabe');
select throws_ok($$select public.update_my_profile('Rober V.', 'rober.v_1', repeat('a', 281))$$, '23514',
  null, 'bio de 281 caracteres se rechaza');
select throws_ok($$select public.update_my_profile('   ', null, null)$$, '23514',
  null, 'el nombre no puede quedar vacio');
select throws_ok($$select public.update_my_profile('Rober V.', 'ab', null)$$, '23514',
  null, 'usuario de 2 caracteres se rechaza');
select throws_ok($$select public.update_my_profile('Rober V.', repeat('a', 31), null)$$, '23514',
  null, 'usuario de 31 caracteres se rechaza');
select throws_ok($$select public.update_my_profile('Rober V.', 'con espacio', null)$$, '23514',
  null, 'usuario con espacio se rechaza');
select throws_ok($$select public.update_my_profile('Rober V.', 'ñandu', null)$$, '23514',
  null, 'usuario con caracteres fuera de [a-z0-9_.] se rechaza');

-- Unicidad sin distinguir mayusculas entre personas
select pg_temp.as_user('diego');
select lives_ok($$select public.update_my_profile('Diego Choque', 'diego', null)$$, 'Diego elige su usuario');
select pg_temp.as_user('jose');
select throws_ok($$select public.update_my_profile('Jose', 'DIEGO', null)$$, '23505',
  null, 'otro usuario no puede repetirlo ni cambiando mayusculas');
select throws_ok($$select public.update_my_profile('Jose', 'diego', null)$$, '23505',
  null, 'ni en minusculas');

-- ---------------------------------------------------------------- sin editar a otros ni columnas privilegiadas
select pg_temp.as_user('rober');
select is(pg_temp.affected($$update public.profiles set name = 'Hackeado' where id = pg_temp.uid('diego')$$), 0,
  'un socio no edita el nombre de otra persona con UPDATE directo');
select is(pg_temp.affected($$update public.profiles set bio = 'x' where id = pg_temp.uid('rober')$$), 0,
  'ni siquiera el propio perfil con UPDATE directo (solo por el RPC)');
select is(pg_temp.affected($$update public.profiles set role = 'admin' where id = pg_temp.uid('rober')$$), 0,
  'nadie se sube el rol');
select is(pg_temp.affected($$update public.profiles set weekly_hours = 1 where id = pg_temp.uid('rober')$$), 0,
  'ni cambia sus horas');
-- Aunque la marca de transaccion exista, las columnas privilegiadas no pueden cambiar.
select throws_ok($$
  select set_config('vexa.profile_self_rpc', '1', true);
  update public.profiles set role = 'admin', username = 'forzado' where id = pg_temp.uid('rober')
$$, '42501', null, 'con la marca puesta a mano, el rol sigue bloqueado por la politica');
select throws_ok($$
  select set_config('vexa.profile_self_rpc', '1', true);
  update public.profiles set weekly_hours = 99 where id = pg_temp.uid('rober')
$$, '42501', null, 'con la marca puesta a mano, las horas siguen bloqueadas');
select is(pg_temp.affected($$update public.profiles set bio = 'x' where id = pg_temp.uid('diego')$$), 0,
  'tampoco el perfil ajeno');
select pg_temp.as_system();
select is((select role::text || '|' || area::text || '|' || weekly_hours::text from public.profiles
  where id = pg_temp.uid('rober')), 'partner|technical|20.00', 'el perfil privilegiado de Rober queda intacto');

-- ---------------------------------------------------------------- auditoria
select is((select count(*)::int from public.audit_log
  where entity_table = 'profiles' and entity_id = pg_temp.uid('rober')::text and event_type = 'member.updated'), 4,
  'cada guardado queda auditado como member.updated');

-- ---------------------------------------------------------------- anon
select pg_temp.as_anon();
select throws_ok($$select public.update_my_profile('x', null, null)$$, '42501', null,
  'anon no ejecuta update_my_profile');
select throws_ok($$select * from public.notification_preferences$$, '42501', null,
  'anon no lee preferencias');
select throws_ok($$select public.set_notification_preferences(false)$$, '42501', null,
  'anon no ejecuta set_notification_preferences');

-- ---------------------------------------------------------------- preferencias propias
select pg_temp.as_user('alex');
select is((select count(*)::int from public.notification_preferences), 0, 'sin fila hasta que se guarda algo');
select is((select (public.set_notification_preferences(false)).task_assigned), false,
  'Alex apaga task_assigned (crea la fila)');
select is((select hours_reminder::text || '|' || weekly_summary::text from public.notification_preferences),
  'true|true', 'lo no indicado queda activado');
select is((select (public.set_notification_preferences(null, false, null)).task_assigned), false,
  'cambiar otra preferencia no toca task_assigned');
select is((select count(*)::int from public.notification_preferences), 1, 'una sola fila propia');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.notification_preferences), 0,
  'Rober no ve las preferencias de Alex');
select is(pg_temp.affected($$update public.notification_preferences set task_assigned = true
  where user_id = pg_temp.uid('alex')$$), 0, 'ni las edita');
select throws_ok($$insert into public.notification_preferences (user_id) values (pg_temp.uid('alex'))$$,
  '42501', null, 'ni inserta a nombre de otra persona');
select pg_temp.as_user('alex');
select throws_ok($$update public.notification_preferences set user_id = pg_temp.uid('rober')$$, '42501', null,
  'el dueno no puede cambiar user_id (sin privilegio de columna)');

-- ---------------------------------------------------------------- task_assigned respeta la preferencia
select pg_temp.as_system();
select set_config('t.proj', (select id::text from public.projects order by created_at limit 1), true);
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.tasks (title, project_id, assignee_id)
  values ('Tarea con aviso apagado', current_setting('t.proj')::uuid, pg_temp.uid('alex'))$$,
  'el admin asigna a quien apago el aviso');
select is(pg_temp.count_of('alex', 'task_assigned'), 0, 'Alex no recibe task_assigned apagado');
select lives_ok($$insert into public.tasks (title, project_id, assignee_id)
  values ('Tarea con aviso activo', current_setting('t.proj')::uuid, pg_temp.uid('diego'))$$,
  'el admin asigna a quien no tiene fila');
select is(pg_temp.count_of('diego', 'task_assigned'), 1, 'sin fila el aviso llega');

select * from finish();
rollback;
