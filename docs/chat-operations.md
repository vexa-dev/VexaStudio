# Operate and verify local chat

Chat uses the selected service (`VITE_DATA_SOURCE=mock` by default, or `supabase`). Local B5 verification does not authorize a cloud rollout. Use the existing local stack; do not reset it, install tools, or run Git as part of this checklist.

## Quick checks

From the repository root, run the installed tools:

```sh
npm run typecheck
npm run lint
npm test
npm run build
DOCKER_HOST=unix:///Users/leosle/.docker/run/docker.sock SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 npm run db:test
```

The Docker socket above is the verified path on this workstation; use only an explicitly authorized local Docker session elsewhere. The telemetry opt-out is process-scoped. Do not start or reset an unavailable stack automatically.

`npm test` without integration environment skips the Supabase integration suites. For real chat integration, obtain the loopback URL and anon key from local `supabase status -o json`, keep them only in process environment as `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and run:

```sh
DOCKER_HOST=unix:///Users/leosle/.docker/run/docker.sock SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 npm test -- apps/web/src/services/supabase/chat.integration.test.ts
```

Never print keys, use cloud credentials, or place a service-role key in frontend code. The integration runner rejects non-loopback URLs and restores captured preferences/status; cleanup targets only test-owned groups, messages, and objects, preserving pre-existing direct conversations.

## Security and lifecycle

| Area             | Operational rule                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access           | Table RLS controls thread membership; admins can access groups, not unrelated direct conversations. Private Storage reads remain authorized by thread access.                                                                                                                                                                                                                                 |
| Presence         | Private `chat-presence:<user UUID>` channels use `realtime.messages` RLS. Publishing binds JWT identity to topic; receiving binds the topic to active permitted profiles. Identity is not trusted from payload. Hidden presence is not published.                                                                                                                                             |
| Account changes  | Query keys include user identity. Media signing clears its cache when the current account changes or signs out. Presence auth changes clear observations/channels and recheck authorized profiles; unsubscribe releases timers, channels, and auth listeners. Cached authorization is refreshed, not treated as permanent permission.                                                         |
| Upload limits    | Attachments: 3 MiB mock, 25 MiB Supabase. Wallpaper: 1 MiB PNG/JPEG/WebP. The backend validates ownership, path, MIME, and size independently of UI.                                                                                                                                                                                                                                          |
| Attachment links | Private signed URLs last one hour. Signing cache reuses them for five minutes; mounted thread/shared queries renew every 50 minutes in the foreground and always refetch on focus. Reused signatures therefore retain at least five minutes of network grace at scheduled renewal. Mock gets no additional polling. Offline/suspended tabs cannot renew until they reconnect or regain focus. |

The renewal options follow [TanStack Query's useQuery reference](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery). Renewal still requires a successful authorized network request; it cannot guarantee access during outages.

## Storage inventory and recovery

Soft deletion is valid even when an admin cannot remove another author's object. Group deletion can also leave Storage objects behind. Cleanup is best effort, not a global purge guarantee.

1. With explicit authorization for a privileged **local read-only** connection, inventory `storage.objects` in `chat-attachments` and `chat-wallpapers`, including object id, name, owner, and creation time. Compare attachment paths with `chat_messages.attachment_path`, and wallpaper paths with the associated preferences. Inspect soft-deleted references and deleted-thread prefixes separately.
2. A missing database reference is a cleanup candidate, not permission to delete. Record the exact test run, thread/message ids, object paths, and owner; distinguish pre-existing objects and legitimate retained content. Preserve uncertain objects.
3. Only after explicit cleanup authorization, remove exact objects proven to belong to that test using the authorized local Storage API/session. Do not delete rows directly from `storage.objects`, use a wildcard/global purge, or borrow an ambient remote session. Restore captured account preferences/status and verify remaining object paths and rows read-only.

No automatic purge is provided. Production retention and orphan cleanup require a separately authorized policy; frontend credentials must never bypass ownership/RLS.

## Evidence and limits

B5 local evidence includes 888 pgTAP assertions, 10 real chat integration tests, and a five-user smoke with five concurrent writes and 25 subscriber events. The smoke proves that scenario, **not** load capacity, latency budgets, or sustained throughput. Browser checks cover ordinary chat/group/settings paths; cross-account browser testing requires an available sign-out/session-switch path. Independent-client integration supplies isolation evidence, not visual proof.

Thread snapshots and shared reads traverse complete history using stable `(created_at, id)` keysets. This avoids dropping timestamp ties and preserves unread counts, but increases queries, mapping work, and memory as history grows; reactions/signatures are batched in 100-message chunks. Fifty-minute renewal avoids frequent full-history polling but does not remove that scaling cost. The separate `loadOlder` contract accepts only a timestamp cursor and cannot express an id tie-break when a page cuts messages with the same millisecond. Large-history pagination redesign and production load testing remain follow-ups, not claimed B5 outcomes.
