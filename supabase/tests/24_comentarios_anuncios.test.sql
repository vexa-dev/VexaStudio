-- Comentarios con @menciones y anuncios: inmutables, visibles segun la entidad padre, autor forzado,
-- una notificacion `mention` por persona mencionada (nunca para uno mismo) y anuncios solo de admin.
-- Ids del seed: 1 Jhony (admin), 2 Rober, 3 Jose, 4 Diego (socios), 5 Alex (colaborador, solo Vexa Studio).
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

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
-- Avisos `mention` de una persona (se cuentan como sistema, sin RLS).
create function pg_temp.mentions_of(p_name text) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.as_system();
  select count(*)::int into n from public.notifications where user_id = pg_temp.uid(p_name) and type = 'mention'
    and payload ? 'commentId';
  return n;
end $$;
grant execute on all functions in schema pg_temp to public;

-- Fixtures (como sistema): una tarea de Fivuza sin Alex, la tarea 5 de Vexa Studio (Alex es miembro) y
-- un registro de horas de Rober con Alex etiquetado.
select pg_temp.as_system();
insert into public.tasks (id, project_id, title, status, assignee_id) values
  ('30000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000002', 'Tarea de Fivuza', 'todo',
   '00000000-0000-4000-8000-000000000002');
insert into public.time_entries (id, user_id, started_at, ended_at, hours, created_at) values
  ('60000000-0000-4000-8000-0000000000f1', pg_temp.uid('rober'), now() - interval '3 hours', now() - interval '1 hour', 2, now()),
  ('60000000-0000-4000-8000-0000000000f2', pg_temp.uid('rober'), now() - interval '6 hours', now() - interval '4 hours', 2, now());
insert into public.time_entry_participants (entry_id, user_id, share_percent) values
  ('60000000-0000-4000-8000-0000000000f1', pg_temp.uid('jose'), 100);

-- ================================================================ estructura
select ok((select relrowsecurity from pg_class where oid = 'public.comments'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.announcements'::regclass), 'RLS activado en ambas tablas');
select ok(not has_table_privilege('anon', 'public.comments', 'select')
  and not has_table_privilege('anon', 'public.announcements', 'select'), 'anon no lee nada');
select ok(not has_table_privilege('authenticated', 'public.comments', 'update')
  and not has_table_privilege('authenticated', 'public.comments', 'delete')
  and not has_table_privilege('authenticated', 'public.announcements', 'delete'),
  'nadie edita ni borra comentarios, nadie borra anuncios');
select ok(not has_column_privilege('authenticated', 'public.comments', 'user_id', 'insert'),
  'user_id no se concede en el INSERT');
select ok(has_column_privilege('authenticated', 'public.announcements', 'pinned', 'update')
  and not has_column_privilege('authenticated', 'public.announcements', 'text', 'update'),
  'de un anuncio solo se edita pinned');

-- ================================================================ insertar lo propio
select pg_temp.as_user('diego');
select lives_ok($$insert into public.comments (entity, entity_id, text, mentions)
  values ('task', '30000000-0000-4000-8000-000000000005', '  Revisa esto @rober  ',
          array['00000000-0000-4000-8000-000000000002']::uuid[])$$, 'diego comenta una tarea de su proyecto');
select is((select user_id from public.comments), pg_temp.uid('diego'), 'user_id es quien llama');
select is((select text from public.comments), 'Revisa esto @rober', 'el texto se recorta');
select is((select cardinality(mentions) from public.comments), 1, 'la mencion valida se conserva');

-- ================================================================ lo que se rechaza
select throws_ok($$insert into public.comments (user_id, entity, entity_id, text)
  values (pg_temp.uid('jose'), 'task', '30000000-0000-4000-8000-000000000005', 'a nombre de jose')$$, '42501',
  null, 'no se puede falsificar user_id');
select throws_ok($$insert into public.comments (entity, entity_id, text)
  values ('task', '30000000-0000-4000-8000-000000000005', '   ')$$, '23514', null, 'un comentario vacio se rechaza');
select throws_ok($$insert into public.comments (entity, entity_id, text)
  values ('task', '30000000-0000-4000-8000-000000000005', repeat('x', 2001))$$, '23514', null,
  'mas de 2000 caracteres se rechaza');
select throws_ok($$insert into public.comments (entity, entity_id, text)
  values ('task', '99999999-0000-4000-8000-000000000000', 'no existe')$$, '42501', null,
  'una entidad inexistente se rechaza (no se puede leer)');

select pg_temp.as_user('diego');
select throws_ok($$update public.comments set text = 'editado'$$, '42501', null, 'nadie edita un comentario');
select throws_ok($$delete from public.comments$$, '42501', null, 'nadie borra un comentario');

-- ================================================================ menciones y avisos
select is(pg_temp.mentions_of('rober'), 1, 'rober recibe exactamente un aviso de mencion');
select is(pg_temp.mentions_of('diego'), 0, 'el autor no recibe aviso');

select pg_temp.as_user('jose');
select lives_ok($$insert into public.comments (entity, entity_id, text, mentions)
  values ('task', '30000000-0000-4000-8000-000000000005', 'Yo me menciono',
          array['00000000-0000-4000-8000-000000000003',
                '00000000-0000-4000-8000-000000000002',
                '00000000-0000-4000-8000-000000000002',
                '00000000-0000-4000-8000-000000000005',
                '99999999-0000-4000-8000-000000000000']::uuid[])$$, 'jose menciona con duplicados, a si mismo y a ids invalidos');
select is((select cardinality(mentions) from public.comments where text = 'Yo me menciono'), 2,
  'la guarda deja solo a rober y a alex (sin duplicados, sin el autor, sin ids desconocidos)');
select is(pg_temp.mentions_of('jose'), 0, 'quien se menciona a si mismo no recibe aviso');
select is(pg_temp.mentions_of('rober'), 2, 'rober recibe un solo aviso por comentario aunque lo repitan');
select is(pg_temp.mentions_of('alex'), 1, 'alex (miembro del proyecto) recibe su aviso');
select pg_temp.as_system();
select is((select payload->>'taskId' from public.notifications where user_id = pg_temp.uid('alex') and type = 'mention'),
  '30000000-0000-4000-8000-000000000005', 'el aviso apunta a la tarea');

-- Una mencion a alguien sin acceso a la tarea no genera aviso ni se guarda.
select pg_temp.as_user('rober');
select lives_ok($$insert into public.comments (entity, entity_id, text, mentions)
  values ('task', '30000000-0000-4000-8000-0000000000f1', 'Aviso para Alex',
          array['00000000-0000-4000-8000-000000000005']::uuid[])$$, 'rober comenta la tarea de Fivuza');
select is((select cardinality(mentions) from public.comments where text = 'Aviso para Alex'), 0,
  'alex no ve la tarea de Fivuza: la mencion se descarta');
select is(pg_temp.mentions_of('alex'), 1, 'alex sigue con un solo aviso');

-- ================================================================ visibilidad por rol
select pg_temp.as_user('alex');
select is((select count(*)::int from public.comments where entity = 'task'
  and entity_id = '30000000-0000-4000-8000-000000000005'), 2, 'alex lee los comentarios de la tarea de su proyecto');
select is((select count(*)::int from public.comments where entity_id = '30000000-0000-4000-8000-0000000000f1'), 0,
  'alex no lee los de la tarea de otro proyecto');
select throws_ok($$insert into public.comments (entity, entity_id, text)
  values ('task', '30000000-0000-4000-8000-0000000000f1', 'colado')$$, '42501', null,
  'alex no comenta una tarea que no ve');
select throws_ok($$insert into public.comments (entity, entity_id, text)
  values ('expense', '50000000-0000-4000-8000-000000000002', 'colado')$$, '42501', null,
  'un colaborador no comenta gastos');

select pg_temp.as_user('jhony');
select is((select count(*)::int from public.comments where entity_id = '30000000-0000-4000-8000-0000000000f1'), 1,
  'el admin lee los comentarios de cualquier tarea');

select pg_temp.as_user('jose');
select lives_ok($$insert into public.comments (entity, entity_id, text, mentions)
  values ('time_entry', '60000000-0000-4000-8000-0000000000f1', 'Objecion: faltan detalles',
          array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005']::uuid[])$$,
  'jose (etiquetado) comenta el registro de horas de rober');
select pg_temp.as_user('alex');
select is((select count(*)::int from public.comments where entity = 'time_entry'), 0,
  'alex no ve el registro de rober ni su hilo');
select pg_temp.as_user('rober');
select is((select count(*)::int from public.comments where entity = 'time_entry'), 1, 'el dueno del registro ve el hilo');
select is((select cardinality(mentions) from public.comments where entity = 'time_entry'), 1,
  'en el registro solo se conserva la mencion de quien lo puede leer (rober)');

-- ================================================================ anuncios
select pg_temp.as_user('jhony');
select lives_ok($$insert into public.announcements (text, pinned) values ('  Reunion el jueves  ', true)$$,
  'el admin publica un anuncio fijado');
select is((select text from public.announcements where pinned order by created_at desc limit 1), 'Reunion el jueves',
  'el texto del anuncio se recorta');
select is((select author_id from public.announcements where text = 'Reunion el jueves'), pg_temp.uid('jhony'),
  'el autor es quien publica');
select lives_ok($$update public.announcements set pinned = false where text = 'Reunion el jueves'$$, 'el admin desfija');

select pg_temp.as_user('rober');
select throws_ok($$insert into public.announcements (text) values ('intruso')$$, '42501', null,
  'un socio no publica anuncios');
select is(pg_temp.affected($$update public.announcements set pinned = true$$), 0, 'un socio no fija anuncios');
select ok((select count(*) from public.announcements) >= 1, 'un socio lee los anuncios');

select pg_temp.as_user('alex');
select is((select count(*)::int from public.announcements), 0, 'un colaborador no ve anuncios (solo admin y socios)');

select * from finish();
rollback;
