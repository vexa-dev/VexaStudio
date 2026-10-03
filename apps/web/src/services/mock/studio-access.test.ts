import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(resetMock);
afterEach(resetMock);
const services = createMockServices();
describe("studio information access", () => {
  it("does not expose expenses, votes, renewals, participation or team totals to collaborators", async () => {
    setSessionUserId("u-demo-collaborator");
    for (const read of [
      () => services.expenses.list(),
      () => services.expenses.listVotes("any"),
      () => services.expenses.listRecurring(),
      () => services.dashboard.getPoints(),
      () => services.dashboard.getMonthlySummary("2026-10"),
    ])
      await expect(read()).rejects.toThrow("acceso");
    expect(
      (await services.time.listEntries()).every(
        (e) => e.userId === "u-demo-collaborator",
      ),
    ).toBe(true);
  });
  it("keeps studio reads available for administrators and partners", async () => {
    for (const userId of ["u-jhony", "u-rober"]) {
      setSessionUserId(userId);
      const [expenses, points, monthly] = await Promise.all([
        services.expenses.list(),
        services.dashboard.getPoints(),
        services.dashboard.getMonthlySummary("2026-10"),
      ]);
      expect(expenses.length).toBeGreaterThan(0);
      expect(points.length).toBe(4);
      expect(monthly.length).toBe(4);
    }
  });
  it("requires a signed in studio member", async () => {
    setSessionUserId(null);
    await expect(services.expenses.list()).rejects.toThrow("acceso");
  });
});
