-- Horas: etiquetas con porcentaje y archivos de evidencia con retencion.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador).
begin;
create extension if not exists pgtap with schema extensions;
select plan(127);

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
create function pg_temp.lima_today() returns date language sql stable as $$
  select (now() at time zone 'America/Lima')::date $$;
create function pg_temp.t(p_name text) returns uuid language sql stable as $$
  select current_setting('t.' || p_name)::uuid $$;
create function pg_temp.fid(p_n int) returns uuid language sql immutable as $$
  select ('20000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid $$;
create function pg_temp.path(p_entry text, p_n int, p_name text default 'f.pdf') returns text
language sql stable as $$ select pg_temp.t(p_entry)::text || '/' || pg_temp.fid(p_n)::text || '/' || p_name $$;
-- Registro manual de ayer con etiquetas opcionales; guarda el id.
create function pg_temp.mk(p_name text, p_hours numeric, p_part jsonb default null) returns void
language plpgsql as $$
begin
  perform set_config('t.' || p_name,
    (public.add_manual_hours(null, pg_temp.lima_today() - 1, p_hours, null,
      'Trabajo de prueba ' || p_name, null, null, p_part)).id::text, true);
end $$;
-- Sube el objeto (quien llama es el dueno del registro).
create function pg_temp.up(p_entry text, p_n int, p_name text default 'f.pdf', p_mime text default 'application/pdf')
returns void language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('hours-evidence', pg_temp.path(p_entry, p_n, p_name), auth.uid(),
    jsonb_build_object('size', 100, 'mimetype', p_mime));
end $$;
create function pg_temp.ev(p_entry text, p_n int, p_name text default 'f.pdf', p_mime text default 'application/pdf')
returns void language plpgsql as $$
begin
  insert into public.time_entry_evidence (id, entry_id, path, name, mime, size)
  values (pg_temp.fid(p_n), pg_temp.t(p_entry), pg_temp.path(p_entry, p_n, p_name), p_name, p_mime, 100);
end $$;
-- Storage bloquea el DELETE directo (protect_delete) salvo con esta marca: asi se evalua la politica real.
create function pg_temp.del_obj(p_entry text, p_n int) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'hours-evidence' and name like pg_temp.t(p_entry)::text || '/' || pg_temp.fid(p_n)::text || '/%';
  get diagnostics n = row_count;
  return n;
end $$;
create function pg_temp.objs(p_entry text) returns int language sql stable as $$
  select count(*)::int from storage.objects where bucket_id = 'hours-evidence' and name like pg_temp.t(p_entry)::text || '/%' $$;
create function pg_temp.entry_month(p_entry text) returns text language sql stable as $$
  select to_char(started_at at time zone 'America/Lima', 'YYYY-MM') from public.time_entries where id = pg_temp.t(p_entry) $$;
create function pg_temp.hrs(p_user text, p_entry text) returns numeric language sql stable as $$
  select hours from public.monthly_summary(pg_temp.entry_month(p_entry)) where user_id = pg_temp.uid(p_user) $$;
create function pg_temp.pts(p_user text) returns numeric language sql stable as $$
  select hour_points from public.member_points where user_id = pg_temp.uid(p_user) $$;
grant execute on all functions in schema pg_temp to public;

-- ================================================================ estructura y privilegios
select pg_temp.as_system();
select has_table('public', 'time_entry_participants', 'existe time_entry_participants');
select has_table('public', 'time_entry_evidence', 'existe time_entry_evidence');
select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.time_entry_participants'::regclass, 'public.time_entry_evidence'::regclass)),
  'ambas tablas tienen RLS');
select ok(not has_table_privilege('anon', 'public.time_entry_participants', 'select')
  and not has_table_privilege('anon', 'public.time_entry_evidence', 'select')
  and not has_table_privilege('anon', 'public.time_entry_participants', 'insert')
  and not has_table_privilege('anon', 'public.time_entry_evidence', 'insert'),
  'anon no tiene nada en las tablas nuevas');
select ok(has_column_privilege('authenticated', 'public.time_entry_participants', 'share_percent', 'update')
  and not has_column_privilege('authenticated', 'public.time_entry_participants', 'user_id', 'update')
  and not has_column_privilege('authenticated', 'public.time_entry_participants', 'created_at', 'insert'),
  'las etiquetas solo cambian el porcentaje; la fecha la fija el servidor');
select ok(has_column_privilege('authenticated', 'public.time_entry_evidence', 'purged_at', 'update')
  and not has_column_privilege('authenticated', 'public.time_entry_evidence', 'purge_after', 'update')
  and not has_column_privilege('authenticated', 'public.time_entry_evidence', 'purge_after', 'insert')
  and not has_column_privilege('authenticated', 'public.time_entry_evidence', 'uploader_id', 'insert')
  and not has_column_privilege('authenticated', 'public.time_entry_evidence', 'name', 'update'),
  'el cliente no fija purge_after, uploader_id ni cambia el nombre');
select is((select public from storage.buckets where id = 'hours-evidence'), false, 'el bucket es privado');
select is((select file_size_limit from storage.buckets where id = 'hours-evidence'), 10485760::bigint,
  'el bucket limita a 10 MiB por archivo');
select ok(not exists (select 1 from storage.buckets b, unnest(b.allowed_mime_types) m
    where b.id = 'hours-evidence' and (m like '%svg%' or m like '%executable%' or m like '%javascript%'
      or m = 'application/octet-stream' or m like '%msdownload%' or m like 'text/html%'))
  and (select 'application/pdf' = any (allowed_mime_types) from storage.buckets where id = 'hours-evidence'),
  'la lista de tipos no incluye svg ni ejecutables');
select ok((select bool_and(not prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
    and not has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p where p.oid in (
    'public.set_hours_participants(uuid, jsonb)'::regprocedure,
    'public.hours_evidence_purgeable(uuid)'::regprocedure)),
  'las RPC nuevas son SECURITY INVOKER: authenticated si, anon no');
select ok(not has_function_privilege('authenticated', 'private.evidence_guard()', 'execute')
  and not has_function_privilege('authenticated', 'private.participants_guard()', 'execute')
  and not has_function_privilege('authenticated', 'private.evidence_retention_sync()', 'execute'),
  'las guardas no se ejecutan a mano');
select is(private.evidence_retention_days(), 7, 'la retencion es de 7 dias en una sola funcion');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'hours\_evidence\_%'), 4,
  'politicas de storage: lectura, subida, baja propia y baja por retencion');

-- ================================================================ etiquetar al crear
select pg_temp.as_user('jose');
select lives_ok($$select pg_temp.mk('e1', 2, '[{"userId":"00000000-0000-4000-8000-000000000002","sharePercent":75},
  {"userId":"00000000-0000-4000-8000-000000000005"}]'::jsonb)$$,
  'registrar 2 h etiquetando a Rober (75 %) y a Alex (sin porcentaje = 100 %)');
select is((select string_agg(user_id::text || ':' || share_percent, ',' order by user_id)
  from public.time_entry_participants where entry_id = pg_temp.t('e1')),
  '00000000-0000-4000-8000-000000000002:75,00000000-0000-4000-8000-000000000005:100',
  'quedan guardados con su porcentaje (100 por defecto)');
select lives_ok($$select pg_temp.mk('e2', 1)$$, 'un registro sin etiquetas sigue funcionando');
select is((select count(*)::int from public.time_entry_participants where entry_id = pg_temp.t('e2')), 0,
  'sin etiquetas');

-- Visibilidad
select pg_temp.as_user('rober');
select is((select count(*)::int from public.time_entries where id = pg_temp.t('e1')), 1, 'la persona etiquetada ve el registro');
select is((select count(*)::int from public.time_entry_participants where entry_id = pg_temp.t('e1')), 2,
  'y sus etiquetas');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.time_entries where id = pg_temp.t('e1')), 1,
  'un colaborador etiquetado tambien ve el registro');
select is((select count(*)::int from public.time_entries where id = pg_temp.t('e2')), 0,
  'pero no los que no lo etiquetan');
select is((select count(*)::int from public.time_entry_participants where entry_id = pg_temp.t('e2')), 0,
  'ni sus etiquetas');
select pg_temp.as_anon();
select throws_like($$select count(*) from public.time_entry_participants$$, 'permission denied%', 'anon no lee etiquetas');
select throws_like($$select public.set_hours_participants('00000000-0000-4000-8000-000000000001', '[]')$$,
  'permission denied%', 'anon no ejecuta la RPC');

-- ================================================================ reglas de las etiquetas
select pg_temp.as_user('jose');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000003"}]')$$, 'No puedes etiquetarte a ti mismo%', 'nadie se etiqueta a si mismo');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000002"},{"userId":"00000000-0000-4000-8000-000000000002"}]')$$,
  'No repitas a una persona%', 'sin duplicados');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000002","sharePercent":0}]')$$, 'El porcentaje debe ser un entero entre 1 y 100%', 'porcentaje 0 no vale');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000002","sharePercent":101}]')$$, 'El porcentaje debe ser un entero entre 1 y 100%', 'porcentaje 101 no vale');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000002","sharePercent":50.5}]')$$, 'El porcentaje debe ser un entero entre 1 y 100%', 'porcentaje con decimales no vale');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"99999999-0000-4000-8000-000000000009"}]')$$, 'La persona etiquetada no est%', 'solo perfiles activos existentes');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  (select jsonb_agg(jsonb_build_object('userId', gen_random_uuid())) from generate_series(1, 11)))$$,
  'Puedes etiquetar hasta 10 personas%', 'maximo 10 etiquetas');
select throws_like($$insert into public.time_entry_participants (entry_id, user_id, share_percent)
  values (pg_temp.t('e2'), pg_temp.uid('rober'), 0)$$, '%share_percent_check%', 'la tabla tambien exige 1..100');
select lives_ok($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000004","sharePercent":50}]')$$, 'el dueno etiqueta despues de crear');
select lives_ok($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000004","sharePercent":25}]')$$, 'el dueno cambia el porcentaje');
select is((select share_percent::int from public.time_entry_participants where entry_id = pg_temp.t('e2')), 25,
  'el porcentaje cambio');
select lives_ok($$select public.set_hours_participants(pg_temp.t('e2'), '[]')$$, 'el dueno quita las etiquetas');
select is((select count(*)::int from public.time_entry_participants where entry_id = pg_temp.t('e2')), 0, 'sin etiquetas');

select pg_temp.as_user('rober');
select throws_like($$select public.set_hours_participants(pg_temp.t('e1'), '[]')$$,
  'Solo puedes modificar tus propios registros%', 'otra persona no cambia las etiquetas');
select throws_like($$insert into public.time_entry_participants (entry_id, user_id) values (pg_temp.t('e2'), pg_temp.uid('diego'))$$,
  'Solo puedes modificar tus propios registros%', 'ni por insercion directa');
select pg_temp.as_system();
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('rober') and type = 'mention'
    and payload ->> 'entryId' = pg_temp.t('e1')::text), 1, 'se avisa a la persona etiquetada');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid('diego') and type = 'mention'
    and payload ->> 'entryId' = pg_temp.t('e2')::text), 1, 'la etiqueta posterior tambien avisa');

-- ================================================================ conteo: solo con revision, al porcentaje
select pg_temp.as_user('jhony');
select set_config('t.pts_jose', pg_temp.pts('jose')::text, true);
select set_config('t.pts_rober', pg_temp.pts('rober')::text, true);
select set_config('t.hrs_jose', pg_temp.hrs('jose', 'e1')::text, true);
select set_config('t.hrs_rober', pg_temp.hrs('rober', 'e1')::text, true);
select pg_temp.as_user('jose');
select lives_ok($$select pg_temp.mk('e3', 2, '[{"userId":"00000000-0000-4000-8000-000000000002","sharePercent":75}]'::jsonb)$$,
  'otro registro de 2 h con Rober al 75 %');
select pg_temp.as_user('jhony');
select is(pg_temp.hrs('jose', 'e1') - current_setting('t.hrs_jose')::numeric, 2::numeric,
  'sin revisar, el dueno cuenta sus horas para el minimo');
select is(pg_temp.hrs('rober', 'e1') - current_setting('t.hrs_rober')::numeric, 0::numeric,
  'sin revisar, la persona etiquetada aun no suma');
select is(pg_temp.pts('jose') - current_setting('t.pts_jose')::numeric, 0::numeric, 'sin revisar no hay puntos');

-- Revision: ni el dueno ni las personas etiquetadas aprueban
select pg_temp.as_user('jose');
select throws_like($$select public.validate_hours(array[pg_temp.t('e3')])$$, 'No puedes aprobar tus propias horas%', 'el dueno no aprueba');
select pg_temp.as_user('rober');
select throws_like($$select public.validate_hours(array[pg_temp.t('e3')])$$,
  'No puedes aprobar horas en las que est%', 'la persona etiquetada no aprueba');
select throws_like($$select public.request_hours_clarification(pg_temp.t('e3'), 'Falta el detalle del trabajo')$$,
  'No puedes aprobar horas en las que est%', 'ni pide aclaracion');
select throws_like($$update public.time_entries set validated = true where id = pg_temp.t('e3')$$,
  'No puedes revisar horas en las que est%', 'ni por actualizacion directa');
select throws_like($$update public.time_entries set review_note = 'Necesita mas detalle del trabajo' where id = pg_temp.t('e3')$$,
  'No puedes revisar horas en las que est%', 'ni escribiendo la aclaracion');
select pg_temp.as_user('diego');
select lives_ok($$select public.validate_hours(array[pg_temp.t('e3'), pg_temp.t('e1')])$$,
  'otro socio aprueba ambos');
select pg_temp.as_user('jhony');
select is(pg_temp.hrs('rober', 'e1') - current_setting('t.hrs_rober')::numeric, 3::numeric,
  'Rober suma 1.5 h + 1.5 h al minimo (75 % de 2 h por dos registros)');
select is(pg_temp.hrs('jose', 'e1') - current_setting('t.hrs_jose')::numeric, 2::numeric, 'Jose conserva su 100 % (suma lo mismo que antes de aprobar)');
select is(pg_temp.pts('rober') - current_setting('t.pts_rober')::numeric, 60::numeric,
  'Rober recibe 20 puntos por hora acreditada (3 h = 60)');
select is(pg_temp.pts('jose') - current_setting('t.pts_jose')::numeric, 80::numeric, 'Jose recibe 4 h = 80 puntos');
select is((select count(*)::int from public.member_points where user_id = pg_temp.uid('alex')), 0,
  'un colaborador etiquetado no aparece en el reparto de puntos');

-- Pagado: sin puntos para ninguno
select pg_temp.as_system();
update public.time_entries set paid = true where id = pg_temp.t('e3');
select pg_temp.as_user('jhony');
select is(pg_temp.pts('rober') - current_setting('t.pts_rober')::numeric, 30::numeric,
  'un registro pagado no da puntos a la persona etiquetada (queda e1: 1.5 h)');
select is(pg_temp.pts('jose') - current_setting('t.pts_jose')::numeric, 40::numeric, 'ni al dueno');

-- Bloqueos
select pg_temp.as_user('jose');
select throws_like($$select public.set_hours_participants(pg_temp.t('e3'), '[]')$$,
  'Este registro ya no se puede editar%', 'un registro pagado no cambia etiquetas');

-- Corregir una aprobacion retira el credito de las personas etiquetadas
select lives_ok($$select public.set_hours_participants(pg_temp.t('e1'),
  '[{"userId":"00000000-0000-4000-8000-000000000002","sharePercent":50}]')$$,
  'el dueno cambia etiquetas de un registro aprobado dentro de la ventana');
select is((select validated from public.time_entries where id = pg_temp.t('e1')), false,
  'el registro vuelve a pendiente');
select pg_temp.as_user('jhony');
select is(pg_temp.pts('rober') - current_setting('t.pts_rober')::numeric, 0::numeric, 'y retira los puntos de la persona etiquetada');
select is(pg_temp.pts('jose') - current_setting('t.pts_jose')::numeric, 0::numeric, 'y los del dueno');
select is(pg_temp.hrs('rober', 'e1') - current_setting('t.hrs_rober')::numeric, 1.5::numeric,
  'el minimo de Rober conserva solo el registro aprobado y pagado (1.5 h), no el que volvio a pendiente');
select pg_temp.as_user('diego');
select lives_ok($$select public.validate_hours(array[pg_temp.t('e1')])$$, 'se aprueba de nuevo');
select pg_temp.as_user('jhony');
select is(pg_temp.pts('rober') - current_setting('t.pts_rober')::numeric, 20::numeric, 'Rober recibe 50 % de 2 h = 1 h = 20 puntos');
select pg_temp.as_user('jose');
select lives_ok($$select public.update_hours(pg_temp.t('e1'), '{"hours": 4}')$$, 'editar las horas devuelve a pendiente');
select pg_temp.as_user('diego');
select lives_ok($$select public.validate_hours(array[pg_temp.t('e1')])$$, 'se aprueba otra vez');
select pg_temp.as_user('jhony');
select is(pg_temp.pts('rober') - current_setting('t.pts_rober')::numeric, 40::numeric,
  'el credito se recalcula con las horas vigentes (4 h al 50 % = 2 h)');

-- Anulado y fuera de ventana
select pg_temp.as_user('jose');
select lives_ok($$select public.void_hours(pg_temp.t('e2'), 'Registro duplicado')$$, 'anular un registro pendiente');
select throws_like($$select public.set_hours_participants(pg_temp.t('e2'),
  '[{"userId":"00000000-0000-4000-8000-000000000002"}]')$$, 'Este registro ya no se puede editar%', 'uno anulado no cambia etiquetas');
select pg_temp.as_system();
update public.time_entries set created_at = now() - interval '30 days' where id = pg_temp.t('e1');
select pg_temp.as_user('jose');
select throws_like($$select public.set_hours_participants(pg_temp.t('e1'), '[]')$$,
  'Este registro ya no se puede editar%', 'fuera de la ventana de edicion tampoco');

-- Auditoria
select pg_temp.as_system();
select ok((select count(*) from public.audit_log where entity_table = 'time_entries'
    and entity_id = pg_temp.t('e1')::text and event_type = 'hours.edited'
    and changes::text like '%participants%') >= 1,
  'el cambio de etiquetas queda en el registro de actividad');
select is(public.verify_audit_chain(), null::bigint, 'la cadena de hashes sigue integra');

-- ================================================================ evidencia
select pg_temp.as_user('jose');
select lives_ok($$select pg_temp.mk('v1', 1, '[{"userId":"00000000-0000-4000-8000-000000000002"}]'::jsonb)$$, 'registro para la evidencia');
select throws_like($$select pg_temp.ev('v1', 1)$$, 'El archivo adjunto no existe en el almacenamiento%', 'no hay fila sin objeto');
select lives_ok($$select pg_temp.up('v1', 1)$$, 'el dueno sube un archivo a la carpeta de su registro');
select lives_ok($$select pg_temp.ev('v1', 1)$$, 'y registra la evidencia');
select is((select uploader_id from public.time_entry_evidence where id = pg_temp.fid(1)), pg_temp.uid('jose'),
  'el servidor fija quien subio');
select is((select purge_after from public.time_entry_evidence where id = pg_temp.fid(1)), null::timestamptz,
  'sin revision no hay fecha de retiro');
select lives_ok($$select pg_temp.up('v1', 2, 'logo.svg', 'image/svg+xml')$$, 'storage acepta el objeto (el bucket filtra por tipo en la API)');
select throws_like($$select pg_temp.ev('v1', 2, 'logo.svg', 'image/svg+xml')$$, 'Este tipo de archivo no est%', 'la fila rechaza svg');
select lives_ok($$select pg_temp.up('v1', 3, 'tool.exe', 'application/pdf')$$, 'objeto con extension peligrosa');
select throws_like($$select pg_temp.ev('v1', 3, 'tool.exe', 'application/pdf')$$, 'Este tipo de archivo no est%', 'la fila rechaza extensiones ejecutables');
select throws_like($$insert into public.time_entry_evidence (id, entry_id, path, name, mime, size)
  values (pg_temp.fid(4), pg_temp.t('v1'), pg_temp.path('v1', 9), 'f.pdf', 'application/pdf', 100)$$,
  'El archivo no corresponde a este registro%', 'la ruta debe llevar el id de la evidencia');
select throws_like($$insert into public.time_entry_evidence (id, entry_id, path, name, mime, size)
  values (pg_temp.fid(5), pg_temp.t('v1'), pg_temp.path('v1', 5), 'f.pdf', 'application/pdf', 20971520)$$,
  'El archivo est%', 'maximo 10 MiB por archivo');
select is(pg_temp.del_obj('v1', 2), 1, 'se limpian los objetos de prueba sin fila (el dueno los quita)');
select is(pg_temp.del_obj('v1', 3), 1, 'idem');
select throws_like($$select pg_temp.up('e3', 1)$$, '%row-level security%', 'no se sube a un registro que ya no se edita');

-- Visibilidad
select pg_temp.as_user('rober');
select is((select count(*)::int from public.time_entry_evidence where entry_id = pg_temp.t('v1')), 1, 'la persona etiquetada ve la evidencia');
select is(pg_temp.objs('v1') > 0, true, 'y el objeto');
select throws_like($$select pg_temp.up('v1', 6)$$, '%row-level security%', 'pero no sube archivos');
select pg_temp.as_user('diego');
select is((select count(*)::int from public.time_entry_evidence where entry_id = pg_temp.t('v1')), 1, 'cualquier socio la ve');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.time_entry_evidence where entry_id = pg_temp.t('v1')), 0, 'quien no ve el registro no ve la evidencia');
select is(pg_temp.objs('v1'), 0, 'ni el objeto');
select pg_temp.as_anon();
select throws_like($$select count(*) from public.time_entry_evidence$$, 'permission denied%', 'anon no lee evidencia');

-- Limite de 5 archivos
select pg_temp.as_user('jose');
select lives_ok($$select pg_temp.up('v1', 7, 'a.png', 'image/png'); select pg_temp.ev('v1', 7, 'a.png', 'image/png');
  select pg_temp.up('v1', 8, 'b.csv', 'text/csv'); select pg_temp.ev('v1', 8, 'b.csv', 'text/csv');
  select pg_temp.up('v1', 9, 'c.zip', 'application/zip'); select pg_temp.ev('v1', 9, 'c.zip', 'application/zip');
  select pg_temp.up('v1', 10, 'd.txt', 'text/plain'); select pg_temp.ev('v1', 10, 'd.txt', 'text/plain')$$,
  'completa 5 archivos (pdf, png, csv, zip y txt)');
select throws_like($$select pg_temp.up('v1', 11)$$, '%row-level security%', 'el sexto objeto no entra');
select throws_like($$select pg_temp.ev('v1', 11)$$, 'Cada registro admite hasta 5 archivos%', 'ni la sexta fila');
select pg_temp.as_system();
select is((select count(*)::int from public.time_entry_evidence where entry_id = pg_temp.t('v1')), 5, 'hay 5 filas');

-- Retencion: se fija al validar, se limpia al revertir, y al anular vence ya
select pg_temp.as_user('diego');
select lives_ok($$select public.validate_hours(array[pg_temp.t('v1')])$$, 'otro socio revisa');
select pg_temp.as_system();
select is((select count(*)::int from public.time_entry_evidence where entry_id = pg_temp.t('v1')
  and purge_after between clock_timestamp() + interval '6 days 23 hours' and clock_timestamp() + interval '7 days 1 hour'), 5,
  'al validar, la evidencia se conserva 7 dias');
select pg_temp.as_user('jose');
select lives_ok($$select public.update_hours(pg_temp.t('v1'), '{"hours": 1.5}')$$, 'corregir la aprobacion');
select pg_temp.as_system();
select is((select count(*)::int from public.time_entry_evidence where entry_id = pg_temp.t('v1') and purge_after is null), 5,
  'al revertir se limpia la fecha de retiro');
select pg_temp.as_user('diego');
select lives_ok($$select public.validate_hours(array[pg_temp.t('v1')])$$, 'se vuelve a validar');
select pg_temp.as_user('jose');
select lives_ok($$select pg_temp.del_obj('v1', 10)$$, 'el dueno quita un objeto de un registro aprobado dentro de la ventana');
select lives_ok($$delete from public.time_entry_evidence where id = pg_temp.fid(10)$$, 'y su fila');
select is((select validated from public.time_entries where id = pg_temp.t('v1')), false,
  'cambiar la evidencia devuelve el registro a pendiente');
select pg_temp.as_system();
select is((select count(*)::int from public.time_entry_evidence where entry_id = pg_temp.t('v1') and purge_after is null), 4,
  'y el resto queda sin fecha de retiro');

-- Anulacion: elegible de inmediato
select pg_temp.as_user('jose');
select lives_ok($$select pg_temp.mk('v2', 1, '[{"userId":"00000000-0000-4000-8000-000000000002"}]'::jsonb);
  select pg_temp.up('v2', 21); select pg_temp.ev('v2', 21)$$, 'otro registro con evidencia');
select lives_ok($$select public.void_hours(pg_temp.t('v2'), 'Se registro por error')$$, 'se anula');
select is((select public.hours_evidence_purgeable(pg_temp.fid(21))), true, 'la evidencia de un registro anulado es retirable de inmediato');
select is((select count(*)::int from public.time_entry_evidence where id = pg_temp.fid(21)
  and purge_after <= clock_timestamp()), 1, 'purge_after ya vencio');

-- Baja por retencion: solo quien ve el registro, solo cuando vence, solo con la API
select pg_temp.as_user('alex');
select is(pg_temp.del_obj('v2', 21), 0, 'quien no ve el registro no retira el objeto');
select pg_temp.as_user('rober');
select throws_like($$update public.time_entry_evidence set purged_at = now() where id = pg_temp.fid(21)$$,
  'El archivo todav%', 'no se marca el retiro mientras el objeto exista');
select throws_like($$update public.time_entry_evidence set name = 'otro.pdf' where id = pg_temp.fid(21)$$,
  'permission denied%', 'el cliente no cambia otras columnas');
select is(pg_temp.del_obj('v1', 1), 0, 'un archivo que aun no vence no se retira (v1 esta pendiente)');
select is(pg_temp.del_obj('v2', 21), 1, 'quien ve el registro retira el objeto vencido');
select lives_ok($$update public.time_entry_evidence set purged_at = now() where id = pg_temp.fid(21)$$,
  'y registra el retiro una vez que el objeto ya no existe');
select ok((select purged_at <= clock_timestamp() and purged_at > clock_timestamp() - interval '1 minute'
  from public.time_entry_evidence where id = pg_temp.fid(21)), 'la hora del retiro la fija el servidor');
select throws_like($$update public.time_entry_evidence set purged_at = null where id = pg_temp.fid(21)$$,
  'El archivo ya fue eliminado%', 'el retiro no se deshace');

-- Vencimiento por el paso del tiempo
select pg_temp.as_user('diego');
select lives_ok($$select public.validate_hours(array[pg_temp.t('v1')])$$, 'v1 se aprueba otra vez');
select pg_temp.as_system();
update public.time_entry_evidence set purge_after = clock_timestamp() - interval '1 minute' where entry_id = pg_temp.t('v1');
select pg_temp.as_user('alex');
select is(pg_temp.del_obj('v1', 1), 0, 'ajeno no retira aunque haya vencido');
select pg_temp.as_user('diego');
select is(pg_temp.del_obj('v1', 1), 1, 'pasados 7 dias cualquiera que ve el registro retira el archivo');
select lives_ok($$update public.time_entry_evidence set purged_at = now() where id = pg_temp.fid(1)$$, 'y marca el retiro');
select pg_temp.as_system();
select ok((select count(*) from public.audit_log where entity_id = pg_temp.t('v1')::text
  and changes::text like '%evidence%') >= 6, 'la evidencia queda en el registro de actividad (subidas, baja y retiro)');
select is(public.verify_audit_chain(), null::bigint, 'y la cadena de hashes sigue integra');

select * from finish();
rollback;
