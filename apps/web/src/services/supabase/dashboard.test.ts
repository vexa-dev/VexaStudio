import { describe, expect, it } from "vitest";
import { createDashboardService } from "./dashboard";
import { argsOf, fakeClient, ok, profileRow } from "./fake-client";

describe("DashboardService de Supabase", () => {
  it("lee el resumen mensual de la función de la base", async () => {
    const { client, calls } = fakeClient({
      tables: { profiles: ok(profileRow("partner")) },
      rpc: {
        monthly_summary: ok([
          {
            user_id: "u1",
            month: "2026-10",
            hours: 12,
            minimum_hours: 48,
            compliance: 0.25,
            meets_minimum: false,
          },
        ]),
      },
    });
    const summary = await createDashboardService(client).getMonthlySummary("2026-10");
    expect(summary).toEqual([
      { userId: "u1", month: "2026-10", hours: 12, minimumHours: 48, compliance: 0.25, meetsMinimum: false },
    ]);
    expect(argsOf(calls, "rpc:monthly_summary", "call")[0][0]).toEqual({
      p_month: "2026-10",
    });
  });

  it("los puntos salen de la vista member_points", async () => {
    const { client } = fakeClient({
      tables: {
        profiles: ok(profileRow("admin")),
        member_points: ok([
          { user_id: "u1", hour_points: 100, money_points: 20, total_points: 120, participation: 1 },
        ]),
      },
    });
    expect(await createDashboardService(client).getPoints()).toEqual([
      { userId: "u1", hourPoints: 100, moneyPoints: 20, totalPoints: 120, participation: 1 },
    ]);
  });

  it("un colaborador no accede al dashboard, como en el mock", async () => {
    const { client, calls } = fakeClient({
      tables: { profiles: ok(profileRow("collaborator")) },
    });
    await expect(createDashboardService(client).getPoints()).rejects.toThrow(
      "Solo los socios y administradores tienen acceso a la información del estudio.",
    );
    expect(calls.some((c) => c.target === "member_points")).toBe(false);
  });
});
