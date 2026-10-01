import { computeCompliance, computePoints, entryPoints, expensePoints, monthlyMinimum } from '@/domain/rules'
import type { MemberMonthlySummary, MemberPoints } from '@/domain/types'
import { monthKey } from '@/lib/dates'
import type { DashboardService } from '../types'
import { getDb } from './db'
import { delay } from './utils'

/**
 * Calcula el resumen con las reglas de `domain/rules.ts`. En la etapa 2 el cálculo pasa a las vistas
 * SQL `member_monthly_summary` y `member_points`; el resultado conserva el mismo tipo.
 */

/** Socios que participan del reparto (activos y con rol de admin o socio). */
function partners() {
  return getDb().profiles.filter((p) => p.active && p.role !== 'collaborator')
}

export function summarizeMonth(month: string): MemberMonthlySummary[] {
  const { timeEntries, absences, settings } = getDb()
  return partners().map((profile) => {
    const hours = timeEntries
      .filter((e) => e.userId === profile.id && !e.voidedAt && monthKey(e.startedAt) === month)
      .reduce((sum, e) => sum + e.hours, 0)
    const reducedHours = absences
      .filter((a) => a.userId === profile.id && a.from.slice(0, 7) === month)
      .reduce((sum, a) => sum + a.reducedHours, 0)
    const minimumHours = monthlyMinimum(profile.weeklyHours, settings, reducedHours)
    const { compliance, meetsMinimum } = computeCompliance(hours, minimumHours)
    return { userId: profile.id, month, hours, minimumHours, compliance, meetsMinimum }
  })
}

export function summarizePoints(): MemberPoints[] {
  const { timeEntries, expenses, settings } = getDb()
  return computePoints(
    partners().map((profile) => ({
      userId: profile.id,
      hourPoints: timeEntries.filter((e) => e.userId === profile.id).reduce((sum, e) => sum + entryPoints(e, settings), 0),
      moneyPoints: expenses.filter((e) => e.paidBy === profile.id).reduce((sum, e) => sum + expensePoints(e, settings), 0),
    })),
  )
}

export const dashboard: DashboardService = {
  async getMonthlySummary(month) {
    return delay(summarizeMonth(month))
  },
  async getPoints() {
    return delay(summarizePoints())
  },
}
