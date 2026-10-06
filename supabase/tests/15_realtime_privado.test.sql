-- The policy keys on realtime.topic() (the joined topic), not on the row's own topic, as in Supabase.
-- Private Realtime topics: authenticated members read the app topics; anon and other topics get nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
create function pg_temp.as_user(n int) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-' || lpad(n::text,12,'0'), 'role','authenticated')::text,true);
  set local role authenticated;
end $$;
grant execute on function pg_temp.as_user(int) to authenticated, anon;
insert into realtime.messages(topic,extension,payload,event,private) values
  ('activity-r-1','postgres_changes','{}','x',true),
  ('notifications-r-1','postgres_changes','{}','x',true),
  ('chat-changes:abc','postgres_changes','{}','x',true),
  ('chat-presence-status:abc','postgres_changes','{}','x',true),
  ('other-topic','postgres_changes','{}','x',true);
select pg_temp.as_user(2);
select set_config('realtime.topic','activity-r-1',true);
select ok((select count(*) from realtime.messages)>0,'Member reads activity topic');
select set_config('realtime.topic','notifications-r-1',true);
select ok((select count(*) from realtime.messages)>0,'Member reads notifications topic');
select set_config('realtime.topic','chat-changes:abc',true);
select ok((select count(*) from realtime.messages)>0,'Member reads chat-changes topic');
select set_config('realtime.topic','chat-presence-status:abc',true);
select ok((select count(*) from realtime.messages)>0,'Member reads chat-presence-status topic');
select set_config('realtime.topic','other-topic',true);
select is((select count(*)::int from realtime.messages),0,'Unlisted topic is unreadable');
select set_config('realtime.topic','activity-r-1',true);
select throws_ok($$insert into realtime.messages(topic,extension,payload,event,private) values (realtime.topic(),'broadcast','{}','x',true)$$,'42501','new row violates row-level security policy for table "messages"','Members cannot publish on app topics');
reset role;
select set_config('request.jwt.claims','',true);
set local role anon;
select set_config('realtime.topic','activity-r-1',true);
select is((select count(*)::int from realtime.messages),0,'Anonymous reads nothing on activity topic');
select set_config('realtime.topic','chat-changes:abc',true);
select is((select count(*)::int from realtime.messages),0,'Anonymous reads nothing on chat topic');
select * from finish();
rollback;
