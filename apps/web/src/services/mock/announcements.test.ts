import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(resetMock);
const services = createMockServices();

describe("mock announcements", () => {
  it("lists pinned first and then newest for studio roles", async () => {
    setSessionUserId("u-rober");
    const list = await services.announcements.list();
    expect(list.map((a) => a.id)).toEqual(["a-1", "a-2"]);
  });

  it("shows a collaborator an empty list, like RLS does", async () => {
    setSessionUserId("u-demo-collaborator");
    expect(await services.announcements.list()).toEqual([]);
  });

  it("lets only the admin publish, trimmed, and pin or unpin", async () => {
    setSessionUserId("u-jhony");
    const created = await services.announcements.create("  Nueva regla  ", { pinned: true });
    expect(created).toMatchObject({ authorId: "u-jhony", text: "Nueva regla", pinned: true });
    expect((await services.announcements.list())[0].id).toBe(created.id);
    const unpinned = await services.announcements.setPinned(created.id, false);
    expect(unpinned.pinned).toBe(false);
    expect(getDb().announcements.find((a) => a.id === created.id)?.pinned).toBe(false);
  });

  it("refuses partners, validates the text and rejects unknown ids", async () => {
    setSessionUserId("u-rober");
    await expect(services.announcements.create("Hola")).rejects.toThrow("administrador");
    await expect(services.announcements.setPinned("a-1", false)).rejects.toThrow("administrador");
    setSessionUserId("u-jhony");
    await expect(services.announcements.create("  ")).rejects.toThrow("vacío");
    await expect(services.announcements.create("x".repeat(1001))).rejects.toThrow("1000");
    await expect(services.announcements.setPinned("nope", true)).rejects.toThrow("no existe");
  });
});
