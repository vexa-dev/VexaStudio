import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(resetMock);
const services = createMockServices();
describe("team daily reads", () => {
  it("reads persisted updates with filters and returns independent copies", async () => {
    setSessionUserId("u-jhony");
    const expected = getDb().dailyUpdates[0];
    const originalDone = expected.done;
    const updates = await services.daily.list({ userId: expected.userId, date: expected.date });
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.every((item) => item.userId === expected.userId && item.date === expected.date)).toBe(true);
    updates[0].done = "modified copy";
    expect(getDb().dailyUpdates[0].done).toBe(originalDone);
  });
  it("blocks team updates for collaborators and signed out sessions", async () => {
    for (const userId of ["u-demo-collaborator", null]) {
      setSessionUserId(userId);
      await expect(services.daily.list()).rejects.toThrow("acceso");
    }
  });
});
