import { entriesCreditedTo } from "@vexa/domain/hours-credit";
import { monthlyActivity } from "@vexa/domain/time-activity";
import {
  computeCompliance,
  computePoints,
  entryPoints,
  expensePoints,
  monthlyMinimum,
} from "@vexa/domain/rules";
import type { MemberMonthlySummary, MemberPoints } from "@vexa/domain/types";
import type { DashboardService } from "@vexa/services";
import { getDb } from "./db";
import { requireStudioAccess } from "./studio-access";
import { delay } from "./utils";

/**
 * Calcula el resumen con las reglas de `domain/rules.ts`. En la etapa 2 el cálculo pasa a las vistas
 * SQL `member_monthly_summary` y `member_points`; el resultado conserva el mismo tipo.
 */

/** Socios que participan del reparto (activos y con rol de admin o socio). */
function partners() {
  return getDb().profiles.filter((p) => p.active && p.role !== "collaborator");
}

export function summarizeMonth(month: string): MemberMonthlySummary[] {
  const { timeEntries, absences, settings } = getDb();
  return partners().map((profile) => {
    // Own entries at 100 % plus the validated ones where the person was tagged, at their share.
    const hours = monthlyActivity(
      entriesCreditedTo(timeEntries, profile.id),
      month,
    ).total;
    const reducedHours = absences
      .filter((a) => a.userId === profile.id && a.from.slice(0, 7) === month)
      .reduce((sum, a) => sum + a.reducedHours, 0);
    const minimumHours = monthlyMinimum(
      profile.weeklyHours,
      settings,
      reducedHours,
    );
    const { compliance, meetsMinimum } = computeCompliance(hours, minimumHours);
    return {
      userId: profile.id,
      month,
      hours,
      minimumHours,
      compliance,
      meetsMinimum,
    };
  });
}

export function summarizePoints(): MemberPoints[] {
  const { timeEntries, expenses, settings } = getDb();
  return computePoints(
    partners().map((profile) => ({
      userId: profile.id,
      hourPoints: timeEntries.reduce(
        (sum, e) => sum + entryPoints(e, settings, profile.id),
        0,
      ),
      moneyPoints: expenses
        .filter((e) => e.paidBy === profile.id)
        .reduce((sum, e) => sum + expensePoints(e, settings), 0),
    })),
  );
}

export const dashboard: DashboardService = {
  async getMonthlySummary(month) {
    requireStudioAccess();
    return delay(summarizeMonth(month));
  },
  async getPoints() {
    requireStudioAccess();
    return delay(summarizePoints());
  },
};
