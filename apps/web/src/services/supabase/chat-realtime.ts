import type { RealtimeChannel } from "@supabase/supabase-js";
import { unwrap } from "./errors";
import type { ChatEvent } from "@vexa/domain/chat";
import type { VexaSupabase } from "@/lib/supabase";

/** PostgreSQL changes are evaluated under the subscriber's table RLS. */
export function createChatRealtime(client: VexaSupabase) {
  const listeners = new Set<(event: ChatEvent) => void>();
  const notify = (event: ChatEvent = {}) => {
    for (const listener of listeners) listener(event);
    if (tracking || presenceListeners.size) void refreshPresence();
  };
  const presenceListeners = new Set<(online: Record<string, number>) => void>();
  const presenceChannels = new Map<string, RealtimeChannel>();
  let tracking = false;
  let actor: string | undefined;
  let generation = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let statusChannel: RealtimeChannel | undefined;
  let authStop: (() => void) | undefined;
  let allowed = new Set<string>();
  const publishPresence = () => {
    const online: Record<string, number> = {};
    for (const [id, channel] of presenceChannels)
      if (
        allowed.has(id) &&
        channel.state === "joined" &&
        Object.values(channel.presenceState()).some(
          (entries) => entries.length > 0,
        )
      )
        online[id] = Date.now(); // Observation time, never a client-supplied timestamp or identity.
    for (const callback of presenceListeners) callback(online);
  };
  async function clearChannels() {
    generation++;
    const channels = [...presenceChannels.values()];
    presenceChannels.clear();
    allowed.clear();
    for (const channel of channels) {
      await channel.untrack();
      await client.removeChannel(channel);
    }
    publishPresence();
  }
  async function refreshPresence() {
    const current = ++generation;
    const user = (await client.auth.getSession()).data.session?.user.id;
    if (!user || (!tracking && !presenceListeners.size)) {
      if (!user) actor = undefined;
      await clearChannels();
      return;
    }
    actor = user;
    try {
      const profiles = unwrap(
        await client.from("profiles").select("id").eq("active", true),
      );
      if (current !== generation) return;
      // Everyone active is visible: presence cannot be switched off.
      allowed = new Set(profiles.map((row) => row.id));
      for (const [id, channel] of presenceChannels)
        if (!allowed.has(id) || (!presenceListeners.size && id !== user)) {
          presenceChannels.delete(id);
          await channel.untrack();
          await client.removeChannel(channel);
        }
      for (const id of allowed) {
        if (!presenceListeners.size && id !== user) continue;
        const existing = presenceChannels.get(id);
        if (existing) {
          if (id === user) {
            if (tracking) await existing.track({ online: true });
            else await existing.untrack();
          }
          continue;
        }
        const channel = client.channel(`chat-presence:${id}`, {
          config: { private: true, presence: { enabled: true } },
        });
        presenceChannels.set(id, channel);
        channel
          .on("presence", { event: "sync" }, publishPresence)
          .subscribe((status) => {
            if (
              status === "SUBSCRIBED" &&
              presenceChannels.get(id) === channel &&
              id === actor &&
              tracking
            )
              void channel.track({ online: true });
            if (status !== "SUBSCRIBED") publishPresence();
          });
      }
      publishPresence();
    } catch {
      // Transient failure: keep the channels, show the last known state and retry on the next tick.
      if (current === generation) publishPresence();
    }
  }
  function startPresence() {
    if (!authStop) {
      const auth = client.auth.onAuthStateChange((event, session) => {
        // auth-js re-emits SIGNED_IN on every tab refocus and TOKEN_REFRESHED hourly; supabase-js
        // already refreshes the Realtime token, so only a sign-out or another user resets channels.
        const next = session?.user.id;
        if (event !== "SIGNED_OUT" && next && next === actor) return;
        if (!next) actor = undefined;
        void clearChannels().then(() => {
          if (tracking || presenceListeners.size)
            setTimeout(() => void refreshPresence(), 0);
        });
      });
      authStop = () => auth.data.subscription.unsubscribe();
    }
    if (!statusChannel) {
      statusChannel = client.channel(
        `chat-presence-status:${crypto.randomUUID()}`,
        { config: { private: true } },
      );
      for (const table of ["chat_status", "profiles"])
        statusChannel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => void refreshPresence(),
        );
      statusChannel.subscribe();
    }
    timer ??= setInterval(() => void refreshPresence(), 15_000);
    void refreshPresence();
  }
  function stopIfUnused() {
    if (tracking || presenceListeners.size) return;
    if (timer) clearInterval(timer);
    timer = undefined;
    authStop?.();
    authStop = undefined;
    if (statusChannel) void client.removeChannel(statusChannel);
    statusChannel = undefined;
    void clearChannels();
  }
  return {
    notify,
    subscribe(listener: (event: ChatEvent) => void) {
      listeners.add(listener);
      let stopped = false;
      const channel = client.channel(`chat-changes:${crypto.randomUUID()}`, {
        config: { private: true, postgres_changes_options: { wait: true } },
      });
      for (const table of [
        "chat_threads",
        "chat_members",
        "chat_reads",
        "chat_messages",
        "chat_reactions",
        "chat_status",
        "chat_attachment_states",
      ])
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            if (stopped) return;
            const row = payload.new as Record<string, unknown>;
            listener(
              typeof row.thread_id === "string"
                ? { threadId: row.thread_id }
                : {},
            );
          },
        );
      channel.subscribe();
      return () => {
        stopped = true;
        listeners.delete(listener);
        void client.removeChannel(channel);
      };
    },
    trackPresence(enabled: boolean) {
      tracking = enabled;
      if (enabled) startPresence();
      else {
        const own = actor ? presenceChannels.get(actor) : undefined;
        if (own) void own.untrack();
        stopIfUnused();
      }
    },
    subscribePresence(callback: (online: Record<string, number>) => void) {
      presenceListeners.add(callback);
      callback({});
      startPresence();
      return () => {
        presenceListeners.delete(callback);
        stopIfUnused();
      };
    },
  };
}
