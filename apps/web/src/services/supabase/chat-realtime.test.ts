import { describe, expect, it, vi } from "vitest";
import type { VexaSupabase } from "@/lib/supabase";
import { createChatRealtime } from "./chat-realtime";
function fixture() {
  const channels: {
    topic: string;
    state: string;
    private: boolean;
    handlers: ((payload?: unknown) => void)[];
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    track: ReturnType<typeof vi.fn>;
    untrack: ReturnType<typeof vi.fn>;
    presenceState: ReturnType<typeof vi.fn>;
  }[] = [];
  const unsubscribe = vi.fn();
  let authChanged: (() => void) | undefined;
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "own" } } },
      })),
      onAuthStateChange: vi.fn((callback: () => void) => {
        authChanged = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
    from: vi.fn((table: string) => {
      const result = {
        data: table === "profiles" ? [{ id: "own" }, { id: "other" }] : [],
        error: null,
      };
      return {
        select: () => ({
          eq: async () => result,
          then: (resolve: (result: unknown) => unknown) =>
            Promise.resolve(result).then(resolve),
        }),
      };
    }),
    channel: vi.fn(
      (topic: string, options?: { config?: { private?: boolean } }) => {
        const channel = {
          topic,
          state: "joined",
          private: options?.config?.private ?? false,
          handlers: [] as ((payload?: unknown) => void)[],
          on: vi.fn(),
          subscribe: vi.fn(),
          track: vi.fn(async () => "ok"),
          untrack: vi.fn(async () => "ok"),
          presenceState: vi.fn(() => ({})),
        };
        channel.on.mockImplementation((_kind, _filter, callback) => {
          channel.handlers.push(callback);
          return channel;
        });
        channel.subscribe.mockImplementation((callback) => {
          callback?.("SUBSCRIBED");
          return channel;
        });
        channels.push(channel);
        return channel;
      },
    ),
    removeChannel: vi.fn(async () => "ok"),
  };
  return {
    client: client as unknown as VexaSupabase,
    raw: client,
    channels,
    unsubscribe,
    changeAuth: () => authChanged?.(),
  };
}
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
describe("chat realtime lifecycle", () => {
  it("subscribes all published tables, scopes events and suppresses callbacks after unsubscribe", () => {
    const f = fixture(),
      events = vi.fn(),
      realtime = createChatRealtime(f.client);
    const stop = realtime.subscribe(events);
    expect(f.channels[0].on).toHaveBeenCalledTimes(6);
    f.channels[0].handlers[0]({ new: { thread_id: "thread" } });
    expect(events).toHaveBeenCalledWith({ threadId: "thread" });
    stop();
    f.channels[0].handlers[0]({ new: {} });
    realtime.notify();
    expect(events).toHaveBeenCalledTimes(1);
    expect(f.raw.removeChannel).toHaveBeenCalledTimes(1);
  });
  it("opens private per-user channels, publishes only own topic, and cleans channels plus auth subscription", async () => {
    const f = fixture(),
      callback = vi.fn(),
      realtime = createChatRealtime(f.client);
    const stop = realtime.subscribePresence(callback);
    realtime.trackPresence(true);
    await flush();
    const presence = f.channels.filter((channel) =>
      channel.topic.startsWith("chat-presence:"),
    );
    expect(presence).toHaveLength(2);
    expect(presence.every((channel) => channel.private)).toBe(true);
    expect(
      presence.find((channel) => channel.topic.endsWith("own"))?.track,
    ).toHaveBeenCalledWith({ online: true });
    expect(
      presence.find((channel) => channel.topic.endsWith("other"))?.track,
    ).not.toHaveBeenCalled();
    realtime.trackPresence(false);
    stop();
    await flush();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
    expect(f.raw.removeChannel).toHaveBeenCalledTimes(3);
  });
  it("attributes observations to the authorized topic rather than payload keys and dates", async () => {
    const f = fixture(),
      callback = vi.fn(),
      realtime = createChatRealtime(f.client);
    const stop = realtime.subscribePresence(callback);
    await flush();
    const other = f.channels.find(
      (channel) => channel.topic === "chat-presence:other",
    )!;
    other.presenceState.mockReturnValue({
      forged: [{ userId: "administrator", at: Number.MAX_SAFE_INTEGER }],
    } as never);
    other.handlers[0]();
    expect(callback.mock.lastCall?.[0].other).toBeLessThanOrEqual(Date.now());
    expect(callback.mock.lastCall?.[0].administrator).toBeUndefined();
    other.state = "closed";
    other.handlers[0]();
    expect(callback.mock.lastCall?.[0]).toEqual({});
    stop();
    await flush();
  });
});

describe("presence auth cleanup", () => {
  it("clears observations on sign out and removes its auth subscription", async () => {
    const f = fixture(),
      callback = vi.fn(),
      realtime = createChatRealtime(f.client);
    const stop = realtime.subscribePresence(callback);
    await flush();
    f.raw.auth.getSession.mockResolvedValue({
      data: { session: null },
    } as never);
    f.changeAuth();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await flush();
    expect(callback.mock.lastCall?.[0]).toEqual({});
    expect(f.raw.removeChannel).toHaveBeenCalledTimes(2);
    stop();
    await flush();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
  it("untracks and removes all channels when tracking alone is disabled", async () => {
    const f = fixture(),
      realtime = createChatRealtime(f.client);
    realtime.trackPresence(true);
    await flush();
    realtime.trackPresence(false);
    await flush();
    expect(f.raw.removeChannel).toHaveBeenCalledTimes(2);
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
});
