-- C34: move_task falla (y no cambia nada) cuando quien llama no es el responsable.
-- Se ejecuta sobre el seed (Alex = 5, tarea ...005 de otro responsable).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

create function pg_temp.as_user(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-4000-8000-00000000000' || case p_name when 'alex' then '5' end)::uuid,
    'role', 'authenticated', 'session_id', 's-' || p_name)::text, true);
  set local role authenticated;
end $$;

select set_config('t.before',
  (select status::text from public.tasks where id = '30000000-0000-4000-8000-000000000005'), true);

select pg_temp.as_user('alex');
select throws_like(
  $$select public.move_task('30000000-0000-4000-8000-000000000005', 'done')$$,
  'Solo puedes trabajar en tus tareas asignadas%',
  'un colaborador no mueve una tarea ajena');
select is(
  (select status::text from public.tasks where id = '30000000-0000-4000-8000-000000000005'),
  current_setting('t.before'),
  'la tarea ajena queda en su estado');

select * from finish();
rollback;
