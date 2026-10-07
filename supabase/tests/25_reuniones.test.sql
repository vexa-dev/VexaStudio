-- Reuniones (M4): solo admin convoca, admin y socios votan y leen, el colaborador no ve nada, el enlace es
-- https, la asistencia llega despues del inicio y nadie borra. Avisos `meeting` solo por trigger.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

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
-- Instante (Lima) del lunes de la semana en curso + p_days dias a las p_hour horas.
create function pg_temp.slot(p_days int, p_hour int) returns timestamptz language sql as $$
  select ((date_trunc('week', now() at time zone 'America/Lima')::date + p_days)::timestamp + make_interval(hours => p_hour)) at time zone 'America/Lima' $$;
-- Avisos `meeting` de una persona y ids de horarios: SECURITY DEFINER para no cambiar el rol de quien prueba.
create function pg_temp.meeting_notices(p_name text, p_key text) returns int language plpgsql security definer as $$
declare n int;
begin
  select count(*)::int into n from public.notifications
  where user_id = pg_temp.uid(p_name) and type = 'meeting' and payload ? p_key;
  return n;
end $$;
create function pg_temp.slot_id(p_n int) returns uuid language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from public.meeting_slots order by starts_at offset p_n - 1 limit 1;
  return v;
end $$;
grant execute on all functions in schema pg_temp to public;

-- ================================================================ estructura
select ok((select relrowsecurity from pg_class where oid = 'public.meetings'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.meeting_slots'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.slot_votes'::regclass), 'RLS activado en las tres tablas');
select ok(not has_table_privilege('anon', 'public.meetings', 'select')
  and not has_table_privilege('anon', 'public.meeting_slots', 'select')
  and not has_table_privilege('anon', 'public.slot_votes', 'select'), 'anon no lee nada');
select ok(not has_table_privilege('authenticated', 'public.meetings', 'delete')
  and not has_table_privilege('authenticated', 'public.meeting_slots', 'delete')
  and not has_table_privilege('authenticated', 'public.slot_votes', 'delete'), 'nadie borra');
select ok(not has_table_privilege('authenticated', 'public.meetings', 'insert')
  and not has_table_privilege('authenticated', 'public.meeting_slots', 'insert'),
  'convocatoria y horarios solo se crean con propose_meeting');
select ok(not has_column_privilege('authenticated', 'public.slot_votes', 'user_id', 'insert'),
  'user_id no se concede en el INSERT del voto');

-- ================================================================ proponer
select pg_temp.as_user('alex');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, pg_temp.slot(8, 15), pg_temp.slot(9, 15)),
  '42501', null, 'un colaborador no convoca');
select pg_temp.as_user('rober');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, pg_temp.slot(8, 15), pg_temp.slot(9, 15)),
  '42501', null, 'un socio no convoca');
select pg_temp.as_anon();
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, pg_temp.slot(8, 15), pg_temp.slot(9, 15)),
  '42501', null, 'anon no ejecuta propose_meeting');
select pg_temp.as_user('jhony');
select throws_ok(format($q$select public.propose_meeting(array[%L]::timestamptz[])$q$, pg_temp.slot(8, 15)),
  '23514', 'Propon 2 o 3 horarios', 'un solo horario se rechaza');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L, %L, %L]::timestamptz[])$q$,
  pg_temp.slot(8, 15), pg_temp.slot(9, 15), pg_temp.slot(10, 15), pg_temp.slot(11, 15)),
  '23514', 'Propon 2 o 3 horarios', 'cuatro horarios se rechazan');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, pg_temp.slot(8, 15), pg_temp.slot(8, 15)),
  '23514', 'Los horarios deben ser distintos', 'horarios repetidos se rechazan');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, now() - interval '1 hour', pg_temp.slot(9, 15)),
  '23514', 'Los horarios deben estar en el futuro', 'un horario pasado se rechaza');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, pg_temp.slot(8, 15), pg_temp.slot(15, 15)),
  '23514', 'Los horarios deben ser de la misma semana', 'horarios de semanas distintas se rechazan');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, pg_temp.slot(15, 15), pg_temp.slot(16, 15)),
  '23514', 'Los horarios deben ser de esta semana o la siguiente', 'dos semanas adelante se rechaza');
select lives_ok(format($q$select public.propose_meeting(array[%L, %L, %L]::timestamptz[])$q$,
  pg_temp.slot(8, 15), pg_temp.slot(9, 15), pg_temp.slot(10, 15)), 'el admin convoca con 3 horarios');
select is((select count(*)::int from public.meetings where status = 'polling'
  and week = date_trunc('week', now() at time zone 'America/Lima')::date + 7 and created_by = pg_temp.uid('jhony')), 1,
  'la convocatoria queda en votacion, con la semana de sus horarios y el admin como autor');
select is((select count(*)::int from public.meeting_slots), 3, 'quedan 3 horarios');
select throws_ok(format($q$select public.propose_meeting(array[%L, %L]::timestamptz[])$q$, pg_temp.slot(11, 15), pg_temp.slot(12, 15)),
  '23505', 'Ya hay una convocatoria para esa semana', 'una segunda convocatoria de la misma semana se rechaza');
select is(pg_temp.meeting_notices('rober', 'meetingId') + pg_temp.meeting_notices('jose', 'meetingId')
  + pg_temp.meeting_notices('diego', 'meetingId'), 3, 'cada socio recibe un aviso de la convocatoria');
select is(pg_temp.meeting_notices('jhony', 'meetingId'), 0, 'quien convoca no se avisa a si mismo');

-- ================================================================ lectura
select pg_temp.as_user('alex');
select is((select count(*)::int from public.meetings) + (select count(*)::int from public.meeting_slots)
  + (select count(*)::int from public.slot_votes), 0, 'un colaborador no ve nada');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.meetings) * 10 + (select count(*)::int from public.meeting_slots), 13,
  'un socio lee la convocatoria y sus horarios');

-- ================================================================ votar
select pg_temp.as_user('alex');
select throws_ok(format($q$insert into public.slot_votes (slot_id, available) values (%L, true)$q$, pg_temp.slot_id(1)),
  '42501', null, 'un colaborador no vota');
select pg_temp.as_user('rober');
select lives_ok(format($q$insert into public.slot_votes (slot_id, available) values (%L, true)$q$, pg_temp.slot_id(1)),
  'un socio vota por si mismo');
select throws_ok(format($q$insert into public.slot_votes (slot_id, user_id, available) values (%L, %L, true)$q$,
  pg_temp.slot_id(2), pg_temp.uid('jose')), '42501', null, 'no se puede votar a nombre de otra persona');
select throws_ok(format($q$insert into public.slot_votes (slot_id, available) values (%L, false)$q$, pg_temp.slot_id(1)),
  '23505', null, 'un solo voto por persona y horario');
select is(pg_temp.affected(format($q$update public.slot_votes set available = false where slot_id = %L$q$, pg_temp.slot_id(1))), 1,
  'el voto propio se cambia mientras no se confirme');
select is((select available from public.slot_votes where slot_id = pg_temp.slot_id(1) and user_id = pg_temp.uid('rober')), false,
  'el cambio quedo guardado');
select pg_temp.as_user('jose');
select is(pg_temp.affected(format($q$update public.slot_votes set available = true where slot_id = %L$q$, pg_temp.slot_id(1))), 0,
  'no se cambia el voto de otra persona');
select pg_temp.as_user('jhony');
select lives_ok(format($q$insert into public.slot_votes (slot_id, available) values (%L, true)$q$, pg_temp.slot_id(2)),
  'el admin tambien vota');

-- ================================================================ confirmar
select pg_temp.as_user('rober');
select is(pg_temp.affected(format($q$update public.meetings set status = 'confirmed', confirmed_slot_id = %L,
  meet_link = 'https://meet.google.com/abc-defg-hij'$q$, pg_temp.slot_id(2))), 0, 'un socio no confirma');
select pg_temp.as_user('alex');
select is(pg_temp.affected(format($q$update public.meetings set status = 'confirmed', confirmed_slot_id = %L,
  meet_link = 'https://meet.google.com/abc-defg-hij'$q$, pg_temp.slot_id(2))), 0, 'un colaborador no confirma');
select pg_temp.as_user('jhony');
select throws_ok(format($q$update public.meetings set status = 'confirmed', confirmed_slot_id = %L,
  meet_link = 'http://meet.google.com/abc'$q$, pg_temp.slot_id(2)), '23514', null, 'el enlace http se rechaza');
select throws_ok(format($q$update public.meetings set status = 'confirmed', confirmed_slot_id = %L,
  meet_link = 'javascript:alert(1)'$q$, pg_temp.slot_id(2)), '23514', null, 'un enlace que no es URL se rechaza');
select throws_ok($q$update public.meetings set status = 'confirmed', confirmed_slot_id = gen_random_uuid(),
  meet_link = 'https://meet.google.com/abc-defg-hij'$q$, '23514', 'El horario no pertenece a esta convocatoria',
  'el horario debe ser de la convocatoria');
select lives_ok(format($q$update public.meetings set status = 'confirmed', confirmed_slot_id = %L,
  meet_link = 'https://meet.google.com/abc-defg-hij'$q$, pg_temp.slot_id(2)), 'el admin confirma con enlace https');
select is((select status::text || '|' || meet_link from public.meetings), 'confirmed|https://meet.google.com/abc-defg-hij',
  'queda confirmada con su enlace');
select is(pg_temp.meeting_notices('rober', 'meetLink') + pg_temp.meeting_notices('jose', 'meetLink')
  + pg_temp.meeting_notices('diego', 'meetLink'), 3, 'cada socio recibe el aviso con la fecha y el enlace');
select is(pg_temp.meeting_notices('jhony', 'meetLink') + pg_temp.meeting_notices('alex', 'meetLink'), 0,
  'ni quien confirma ni el colaborador reciben aviso');

-- ================================================================ despues de confirmar
select pg_temp.as_user('rober');
select throws_ok(format($q$update public.slot_votes set available = true where slot_id = %L$q$, pg_temp.slot_id(1)),
  '23514', 'La votacion ya termino', 'no se cambia un voto despues de confirmar');
select pg_temp.as_user('jose');
select throws_ok(format($q$insert into public.slot_votes (slot_id, available) values (%L, true)$q$, pg_temp.slot_id(3)),
  '23514', 'La votacion ya termino', 'no se vota por primera vez despues de confirmar');

-- ================================================================ asistencia
select pg_temp.as_user('rober');
select is(pg_temp.affected(format($q$update public.meetings set status = 'held', attendee_ids = array[%L]::uuid[]$q$,
  pg_temp.uid('rober'))), 0, 'un socio no marca asistencia');
select pg_temp.as_user('jhony');
select throws_ok(format($q$update public.meetings set status = 'held', attendee_ids = array[%L]::uuid[]$q$, pg_temp.uid('rober')),
  '23514', 'La asistencia se marca cuando la reunion ya empezo', 'no hay asistencia antes del inicio');
select pg_temp.as_system();
select lives_ok(format($q$update public.meeting_slots set starts_at = now() - interval '1 hour' where id = %L$q$, pg_temp.slot_id(2)),
  'el reloj avanza (el horario confirmado ya empezo)');
select pg_temp.as_user('jhony');
select throws_ok(format($q$update public.meetings set status = 'held', attendee_ids = array[%L]::uuid[]$q$, pg_temp.uid('alex')),
  '23514', 'Solo admin y socios activos pueden asistir', 'un colaborador no puede figurar como asistente');
select lives_ok(format($q$update public.meetings set status = 'held', attendee_ids = array[%L, %L, %L]::uuid[]$q$,
  pg_temp.uid('jhony'), pg_temp.uid('rober'), pg_temp.uid('jhony')), 'el admin marca la asistencia');
select is((select status::text || '|' || cardinality(attendee_ids) from public.meetings), 'held|2',
  'queda realizada y sin asistentes repetidos');
select throws_ok($q$update public.meetings set attendee_ids = '{}'$q$, '23514', null, 'una reunion realizada no vuelve a cambiar');

-- ================================================================ nadie borra
select throws_ok($q$delete from public.meetings$q$, '42501', null, 'nadie borra convocatorias');
select pg_temp.as_anon();
select throws_ok($q$select count(*) from public.meetings$q$, '42501', null, 'anon no consulta');

select * from finish();
rollback;
