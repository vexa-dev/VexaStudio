-- Private-only Realtime: with "Allow public access" OFF every channel must be private:true.
-- Postgres Changes rows are still filtered by each table's RLS; these policies only let an
-- authenticated, active member join the app's private topics (random per-subscription suffixes,
-- so the scope is the topic prefix). Nobody can publish: no INSERT policy is added, and anon has none.
-- The Supabase docs do not state whether postgres_changes on a private channel is checked against
-- realtime.messages, so the read is allowed for every extension the join may probe (harmless: no writes).
create policy realtime_private_topics_read on realtime.messages
for select to authenticated using (
  extension in ('broadcast', 'presence', 'postgres_changes')
  and public.auth_role() is not null
  and (
    (select realtime.topic()) like 'activity-%'
    or (select realtime.topic()) like 'notifications-%'
    or (select realtime.topic()) like 'chat-changes:%'
    or (select realtime.topic()) like 'chat-presence-status:%'
  )
);
