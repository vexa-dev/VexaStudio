-- Topic/JWT-bound Presence permissions; every fixture rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
create function pg_temp.as_user(n int) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-' || lpad(n::text,12,'0'), 'role','authenticated')::text,true);
  set local role authenticated;
end $$;
create function pg_temp.topic(n int) returns void language sql as $$
  select set_config('realtime.topic','chat-presence:00000000-0000-4000-8000-' || lpad(n::text,12,'0'),true)::text::void $$;
create function pg_temp.send() returns void language sql as $$
  insert into realtime.messages (topic,extension,payload,event,private)
  values (realtime.topic(),'presence','{}','track',true) $$;
grant execute on function pg_temp.as_user(int), pg_temp.topic(int), pg_temp.send() to authenticated, anon;
insert into realtime.messages(topic,extension,payload,event,private) values ('fixture','presence','{}','track',true);
select pg_temp.as_user(2);
select pg_temp.topic(2);
select lives_ok('select pg_temp.send()', 'Active member can publish own topic');
select is((select count(*)::int from realtime.messages),2,'Active member can read own topic');
select pg_temp.topic(5);
select throws_ok('select pg_temp.send()', '42501', 'new row violates row-level security policy for table "messages"','Other member topic cannot be published');
select is((select count(*)::int from realtime.messages),2,'Active collaborator topic is readable');
select set_config('realtime.topic','chat-presence:invalid',true);
select is((select count(*)::int from realtime.messages),0,'Invalid topic is unreadable');
select throws_ok('select pg_temp.send()', '42501', 'new row violates row-level security policy for table "messages"','Invalid topic cannot be published');
select pg_temp.topic(2);
select throws_ok($$insert into realtime.messages(topic,extension,payload,event,private) values (realtime.topic(),'broadcast','{}','event',true)$$,'42501','new row violates row-level security policy for table "messages"','Presence authorization does not grant broadcast');
reset role;
insert into public.chat_status(user_id,presence) values ('00000000-0000-4000-8000-000000000005',false) on conflict(user_id) do update set presence=false;
select pg_temp.as_user(2); select pg_temp.topic(5);
select is((select count(*)::int from realtime.messages),0,'Presence disabled topic is unreadable');
select pg_temp.as_user(5);
select throws_ok('select pg_temp.send()','42501','new row violates row-level security policy for table "messages"','Disabled user cannot publish own presence');
reset role;
update public.profiles set active=false where id='00000000-0000-4000-8000-000000000002';
select pg_temp.as_user(2); select pg_temp.topic(2);
select is((select count(*)::int from realtime.messages),0,'Inactive member cannot read presence');
select throws_ok('select pg_temp.send()','42501','new row violates row-level security policy for table "messages"','Inactive member cannot publish');
reset role;
select set_config('request.jwt.claims','',true);
set local role anon;
select is((select count(*)::int from realtime.messages),0,'Anonymous receives no private presence');
select * from finish();
rollback;
