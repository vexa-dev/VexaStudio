-- Private per-user Presence: JWT controls publishing; receivers derive identity from the topic.
-- Table RLS does not protect public Presence channels. Clients must always use private:true.
-- No unrelated Realtime policies or settings are changed.
create policy chat_presence_read on realtime.messages
for select to authenticated using (
  extension = 'presence'
  and public.auth_role() is not null
  and exists (
    select 1 from public.profiles p
    left join public.chat_status s on s.user_id = p.id
    where p.active and coalesce(s.presence, true)
      and (select realtime.topic()) = 'chat-presence:' || p.id::text
  )
);
create policy chat_presence_write_own on realtime.messages
for insert to authenticated with check (
  extension = 'presence'
  and public.auth_role() is not null
  and (select realtime.topic()) = 'chat-presence:' || (select auth.uid())::text
  and not exists (
    select 1 from public.chat_status s
    where s.user_id = (select auth.uid()) and not s.presence
  )
);
