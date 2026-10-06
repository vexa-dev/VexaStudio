import { describe, expect, it, vi } from "vitest";

const channels: { topic: string; options?: { config?: { private?: boolean } } }[] = [];
const channelStub = (topic: string, options?: { config?: { private?: boolean } }) => {
  const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
  channels.push({ topic, options });
  return channel;
};
vi.mock("@/lib/supabase", () => ({
  newRequestId: () => "rid",
  getSupabase: () => ({ channel: channelStub, removeChannel: vi.fn() }),
}));

import { subscribeToAuditInserts, subscribeToNotifications } from "./realtime";

describe("realtime subscriptions", () => {
  it("opens activity and notification channels as private", () => {
    subscribeToAuditInserts(() => {});
    subscribeToNotifications("user", () => {});
    expect(channels.map((c) => c.topic)).toEqual([
      "activity-rid",
      "notifications-rid",
    ]);
    expect(channels.every((c) => c.options?.config?.private === true)).toBe(true);
  });
});
