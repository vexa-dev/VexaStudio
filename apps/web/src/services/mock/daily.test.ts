import { beforeEach, describe, expect, it } from "vitest";
import { todayLima } from "@vexa/domain/dates";
import { getDb, resetMock, save, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(resetMock);
const services = createMockServices();
const INPUT = { done: "  Cerré el módulo  ", willDo: "Pruebas", blockers: "" };

describe("daily reads", () => {
  it("reads persisted updates with filters, newest first, and returns independent copies", async () => {
    setSessionUserId("u-jhony");
    const expected = getDb().dailyUpdates[0];
    const originalDone = expected.done;
    const updates = await services.daily.list({ userId: expected.userId, date: expected.date });
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.every((item) => item.userId === expected.userId && item.date === expected.date)).toBe(true);
    updates[0].done = "modified copy";
    expect(getDb().dailyUpdates[0].done).toBe(originalDone);
    const all = await services.daily.list();
    expect(all.map((u) => u.date)).toEqual([...all.map((u) => u.date)].sort().reverse());
  });
  it("shows a collaborator only their own dailies and blocks signed out sessions", async () => {
    setSessionUserId("u-demo-collaborator");
    await services.daily.submit(INPUT);
    const own = await services.daily.list();
    expect(own).toHaveLength(1);
    expect(own[0].userId).toBe("u-demo-collaborator");
    setSessionUserId(null);
    await expect(services.daily.list()).rejects.toThrow("sesión");
    await expect(services.daily.submit(INPUT)).rejects.toThrow("sesión");
  });
});

describe("daily submit", () => {
  it("stores today's daily for the signed-in person, trimmed, and shares it with partners", async () => {
    setSessionUserId("u-rober");
    const sent = await services.daily.submit(INPUT);
    expect(sent).toMatchObject({ userId: "u-rober", date: todayLima(), done: "Cerré el módulo", willDo: "Pruebas" });
    expect(sent.updatedAt).toBeTruthy();
    setSessionUserId("u-jhony");
    const seen = await services.daily.list({ userId: "u-rober", date: todayLima() });
    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe(sent.id);
  });
  it("corrects the same day instead of duplicating", async () => {
    setSessionUserId("u-rober");
    const first = await services.daily.submit(INPUT);
    const second = await services.daily.submit({ ...INPUT, done: "Corregido" });
    expect(second.id).toBe(first.id);
    const mine = await services.daily.list({ userId: "u-rober", date: todayLima() });
    expect(mine).toHaveLength(1);
    expect(mine[0].done).toBe("Corregido");
  });
  it("rejects an empty daily", async () => {
    setSessionUserId("u-rober");
    await expect(services.daily.submit({ done: " ", willDo: "", blockers: "x" })).rejects.toThrow("qué hiciste");
  });
});

describe("daily suggestDone", () => {
  it("builds the text from the person's finished hours since their last daily", async () => {
    setSessionUserId("u-rober");
    const db = getDb();
    const task = db.tasks.find((t) => t.assigneeId === "u-rober")!;
    const start = new Date(Date.now() - 2 * 3600_000);
    db.timeEntries.push({
      id: "e-daily-1",
      userId: "u-rober",
      taskId: task.id,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + 3600_000).toISOString(),
      hours: 1,
      paid: false,
      validated: false,
      validatedAt: null,
      createdAt: start.toISOString(),
      voidedAt: null,
      voidReason: null,
    });
    save();
    expect(await services.daily.suggestDone()).toBe(`• ${task.title}`);
  });
});
