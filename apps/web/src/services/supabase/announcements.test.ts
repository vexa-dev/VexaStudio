import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok, profileRow } from "./fake-client";
import { createAnnouncementService } from "./announcements";

const row = {
  id: "a1",
  author_id: "u1",
  text: "Reunión el jueves",
  pinned: true,
  created_at: "2026-10-07T20:00:00+00:00",
};
const mapped = {
  id: "a1",
  authorId: "u1",
  text: "Reunión el jueves",
  pinned: true,
  createdAt: "2026-10-07T20:00:00.000Z",
};

describe("AnnouncementService de Supabase", () => {
  it("lists pinned first and then newest", async () => {
    const { client, calls } = fakeClient({ tables: { profiles: ok(profileRow("partner")), announcements: ok([row]) } });
    expect(await createAnnouncementService(client).list()).toEqual([mapped]);
    expect(argsOf(calls, "announcements", "order").slice(0, 2)).toEqual([
      ["pinned", { ascending: false }],
      ["created_at", { ascending: false }],
    ]);
  });

  it("lets an admin publish a trimmed announcement", async () => {
    const { client, calls } = fakeClient({ tables: { profiles: ok(profileRow("admin")), announcements: ok(row) } });
    await createAnnouncementService(client).create("  Reunión el jueves ", { pinned: true });
    expect(argsOf(calls, "announcements", "insert")[0]).toEqual([{ text: "Reunión el jueves", pinned: true }]);
  });

  it("refuses non-admins before touching announcements and validates the text", async () => {
    const partner = fakeClient({ tables: { profiles: ok(profileRow("partner")) } });
    await expect(createAnnouncementService(partner.client).create("Hola")).rejects.toThrow("administrador");
    await expect(createAnnouncementService(partner.client).setPinned("a1", true)).rejects.toThrow("administrador");
    expect(argsOf(partner.calls, "announcements", "insert")).toHaveLength(0);
    await expect(createAnnouncementService(partner.client).create("  ")).rejects.toThrow("vacío");
  });

  it("pins and unpins by id", async () => {
    const { client, calls } = fakeClient({ tables: { profiles: ok(profileRow("admin")), announcements: ok({ ...row, pinned: false }) } });
    const result = await createAnnouncementService(client).setPinned("a1", false);
    expect(result.pinned).toBe(false);
    expect(argsOf(calls, "announcements", "update")[0]).toEqual([{ pinned: false }]);
    expect(argsOf(calls, "announcements", "eq")[0]).toEqual(["id", "a1"]);
  });
});
