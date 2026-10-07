-- C1: gestion de miembros. set_member_role / set_member_active: solo admin activo, nunca sobre uno mismo,
-- nunca dejando al estudio sin administrador activo; desactivar pide motivo; la persona inactiva pierde el
-- acceso y no puede reactivarse; la auditoria guarda rol, estado y motivo; anon no ejecuta nada.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

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
-- Filas visibles para la sesion actual en todas las tablas/vistas de public (las que no se pueden leer cuentan 0).
create function pg_temp.visible_rows() returns text language plpgsql as $$
declare r record; n int; acc text := '';
begin
  for r in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'v') order by 1 loop
    begin
      execute format('select count(*)::int from public.%I', r.relname) into n;
      if n > 0 then acc := acc || r.relname || ' '; end if;
    exception when others then null;
    end;
  end loop;
  return btrim(acc);
end $$;
grant execute on all functions in schema pg_temp to public;

-- ---------------------------------------------------------------- estructura
select pg_temp.as_system();
select has_function('public', 'set_member_role', array['uuid', 'user_role', 'text'], 'existe set_member_role');
select has_function('public', 'set_member_active', array['uuid', 'boolean', 'text'], 'existe set_member_active');
select is((select prosecdef from pg_proc where proname = 'set_member_role' and pronamespace = 'public'::regnamespace),
  false, 'set_member_role es SECURITY INVOKER');
select is((select prosecdef from pg_proc where proname = 'set_member_active' and pronamespace = 'public'::regnamespace),
  false, 'set_member_active es SECURITY INVOKER');

-- ---------------------------------------------------------------- admin cambia el rol
select pg_temp.as_user('jhony');
select is((select (public.set_member_role(pg_temp.uid('alex'), 'partner', 'Aprobado en votacion')).role::text),
  'partner', 'el admin promueve a un colaborador a socio');
select is((select role::text from public.profiles where id = pg_temp.uid('alex')), 'partner', 'el cambio queda guardado');
select is((select (public.set_member_role(pg_temp.uid('alex'), 'partner')).role::text), 'partner',
  'repetir el mismo rol no falla (idempotente)');
select pg_temp.as_system();
select is((select event_type::text || '|' || coalesce(reason, 'null') from public.audit_log
  where entity_table = 'profiles' and entity_id = pg_temp.uid('alex')::text and event_type = 'member.role_changed'
  order by seq desc limit 1), 'member.role_changed|Aprobado en votacion',
  'la auditoria registra member.role_changed con la nota');
select is((select count(*)::int from public.audit_log where entity_table = 'profiles'
  and entity_id = pg_temp.uid('alex')::text and event_type = 'member.role_changed'), 1,
  'repetir el rol no agrega otra entrada');
select is(coalesce(current_setting('vexa.audit_reason', true), ''), '', 'la nota no se filtra a la transaccion');

-- ---------------------------------------------------------------- permisos y guardas del cambio de rol
select pg_temp.as_user('rober');
select throws_ok($$select public.set_member_role(pg_temp.uid('alex'), 'collaborator')$$, '42501',
  'Solo un administrador gestiona al equipo', 'un socio no cambia roles');
select pg_temp.as_user('alex');
select throws_ok($$select public.set_member_role(pg_temp.uid('alex'), 'admin')$$, '42501',
  'Solo un administrador gestiona al equipo', 'nadie se promueve solo');
select pg_temp.as_user('jhony');
select throws_ok($$select public.set_member_role(pg_temp.uid('jhony'), 'partner')$$, '42501',
  'No puedes cambiar tu propio rol', 'el admin no cambia su propio rol');
select throws_ok($$select public.set_member_role('00000000-0000-4000-8000-0000000000ff', 'partner')$$, '22023',
  'Miembro no valido', 'una persona inexistente se rechaza');
select throws_ok($$select public.set_member_role(pg_temp.uid('rober'), 'partner', repeat('x', 281))$$, '22001',
  'El motivo puede tener hasta 280 caracteres', 'la nota tiene tope');
select pg_temp.as_anon();
select throws_ok($$select public.set_member_role(pg_temp.uid('alex'), 'admin')$$, '42501', null,
  'anon no ejecuta set_member_role');
select throws_ok($$select public.set_member_active(pg_temp.uid('alex'), false, 'x')$$, '42501', null,
  'anon no ejecuta set_member_active');

-- ---------------------------------------------------------------- ultimo administrador
select pg_temp.as_user('jhony');
select is((select (public.set_member_role(pg_temp.uid('rober'), 'admin')).role::text), 'admin', 'segundo admin');
select pg_temp.as_user('rober');
select is((select (public.set_member_role(pg_temp.uid('jhony'), 'partner')).role::text), 'partner',
  'con dos admins se puede bajar a uno');
select pg_temp.as_user('jhony');
select throws_ok($$select public.set_member_role(pg_temp.uid('rober'), 'partner')$$, '42501',
  'Solo un administrador gestiona al equipo', 'un ex admin ya no administra');
-- Defensa en profundidad: una sesion que no es el admin pero salta RLS (rol dueño) tampoco deja al estudio sin admin.
select pg_temp.as_system();
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid('alex'), 'role', 'authenticated')::text, true);
select throws_ok($$update public.profiles set role = 'partner' where id = pg_temp.uid('rober')$$, '23514',
  'Debe quedar al menos un administrador activo', 'la tabla protege al ultimo admin (rol)');
select throws_ok($$update public.profiles set active = false where id = pg_temp.uid('rober')$$, '23514',
  'Debe quedar al menos un administrador activo', 'la tabla protege al ultimo admin (estado)');
select pg_temp.as_user('rober');
select throws_ok($$update public.profiles set role = 'partner' where id = pg_temp.uid('rober')$$, '42501',
  'No puedes cambiar tu propio rol', 'UPDATE directo sobre uno mismo se frena en la tabla');
select throws_ok($$update public.profiles set active = false where id = pg_temp.uid('rober')$$, '42501',
  'No puedes desactivarte a ti mismo', 'no te desactivas con UPDATE directo');
select throws_ok($$select public.set_member_active(pg_temp.uid('rober'), false, 'x')$$, '42501',
  'No puedes desactivarte a ti mismo', 'el RPC tampoco deja desactivarse');
select is((select (public.set_member_role(pg_temp.uid('jhony'), 'admin')).role::text), 'admin', 'Jhony vuelve a admin');

-- ---------------------------------------------------------------- desactivar: motivo y permisos
select pg_temp.as_user('jhony');
select throws_ok($$select public.set_member_active(pg_temp.uid('alex'), false)$$, '23514',
  'Escribe el motivo de la desactivacion', 'desactivar exige motivo');
select throws_ok($$select public.set_member_active(pg_temp.uid('alex'), false, '   ')$$, '23514',
  'Escribe el motivo de la desactivacion', 'un motivo en blanco no vale');
select pg_temp.as_user('diego');
select throws_ok($$select public.set_member_active(pg_temp.uid('alex'), false, 'x')$$, '42501',
  'Solo un administrador gestiona al equipo', 'un socio no desactiva');
select pg_temp.as_user('jhony');
select throws_ok($$select public.set_member_active(pg_temp.uid('jhony'), false, 'x')$$, '42501',
  'No puedes desactivarte a ti mismo', 'el admin no se desactiva');

-- ---------------------------------------------------------------- la persona inactiva pierde el acceso
select pg_temp.as_user('alex');
select isnt(pg_temp.visible_rows(), '', 'antes de desactivar, Alex ve datos');
select pg_temp.as_user('jhony');
select is((select (public.set_member_active(pg_temp.uid('alex'), false, 'Dejo el estudio')).active), false,
  'el admin desactiva a Alex con motivo');
select pg_temp.as_user('alex');
select is(pg_temp.visible_rows(), '', 'inactivo: no ve ninguna tabla ni vista de public');
select is(pg_temp.affected($$update public.profiles set active = true where id = pg_temp.uid('alex')$$), 0,
  'inactivo: no se reactiva con UPDATE directo');
select throws_ok($$select public.set_member_active(pg_temp.uid('alex'), true)$$, '42501',
  'Solo un administrador gestiona al equipo', 'inactivo: no se reactiva con el RPC');
select throws_ok($$insert into public.daily_updates (user_id, work_date, did, will_do) values
  (pg_temp.uid('alex'), (now() at time zone 'America/Lima')::date, 'x', 'y')$$, null, null,
  'inactivo: no escribe datos');
select pg_temp.as_system();
select is((select event_type::text || '|' || coalesce(reason, 'null') from public.audit_log
  where entity_table = 'profiles' and entity_id = pg_temp.uid('alex')::text
  order by seq desc limit 1), 'member.deactivated|Dejo el estudio', 'la auditoria registra member.deactivated con el motivo');

-- ---------------------------------------------------------------- reactivar
select pg_temp.as_user('jhony');
select is((select (public.set_member_active(pg_temp.uid('alex'), true)).active), true, 'el admin reactiva a Alex sin motivo');
select is((select (public.set_member_active(pg_temp.uid('alex'), true)).active), true, 'reactivar de nuevo es idempotente');
select pg_temp.as_user('alex');
select isnt(pg_temp.visible_rows(), '', 'reactivado: Alex vuelve a ver datos');
select pg_temp.as_system();
select is((select event_type::text from public.audit_log where entity_table = 'profiles'
  and entity_id = pg_temp.uid('alex')::text order by seq desc limit 1), 'member.updated',
  'la reactivacion queda auditada como member.updated');

-- ---------------------------------------------------------------- un admin inactivo no administra
select pg_temp.as_user('jhony');
select is((select (public.set_member_active(pg_temp.uid('rober'), false, 'Licencia')).active), false,
  'el admin desactiva a otro admin si queda uno activo');
select pg_temp.as_user('rober');
select throws_ok($$select public.set_member_active(pg_temp.uid('rober'), true)$$, '42501', null,
  'el admin inactivo no se reactiva solo');
select throws_ok($$select public.set_member_role(pg_temp.uid('alex'), 'admin')$$, '42501',
  'Solo un administrador gestiona al equipo', 'el admin inactivo no cambia roles');

select * from finish();
rollback;
