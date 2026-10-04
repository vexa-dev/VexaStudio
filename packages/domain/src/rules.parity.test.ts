import { describe, expect, it } from 'vitest'
import {
  computeCompliance,
  computePoints,
  entryPoints,
  expensePoints,
  monthlyMinimum,
} from './rules'
import { monthlyActivity } from './time-activity'
import type { Expense, TimeEntry } from './types'

/**
 * PARIDAD con la base de datos: este fixture literal y sus números esperados son idénticos a
 * `supabase/tests/04_vistas_paridad.test.sql` (vistas `monthly_summary`, `member_monthly_summary`
 * y `member_points`). Si cambias un valor aquí, cámbialo allá (y viceversa): las dos pruebas
 * deben seguir diciendo lo mismo, porque las reglas existen en TypeScript (mock) y en SQL.
 *
 * Usuarios: P1 admin 15 h/sem, P2 socio 20, P3 socio 15, P4 socio 25; C = colaborador (no cuenta).
 */
const settings = {
  pointsPerHour: 20,
  pointsPerSol: 2,
  minCompliance: 0.8,
  weeksPerMonth: 4,
  expenseApprovalLimitPen: 50,
  entryEditDays: 7,
}
const members = [
  { id: 'P1', weeklyHours: 15 },
  { id: 'P2', weeklyHours: 20 },
  { id: 'P3', weeklyHours: 15 },
  { id: 'P4', weeklyHours: 25 },
]
// Ausencias justificadas por mes del `from` (P3: 6 h en septiembre, 3 h en octubre).
const absences = [
  { userId: 'P3', from: '2026-09-10', reducedHours: 6 },
  { userId: 'P3', from: '2026-10-02', reducedHours: 3 },
]

let n = 0
function entry(
  userId: string,
  startedAt: string,
  hours: number,
  extra: Partial<TimeEntry> = {},
): TimeEntry {
  n += 1
  return {
    id: `e${n}`,
    userId,
    taskId: null,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + hours * 3600000).toISOString(),
    hours,
    paid: false,
    validated: false,
    validatedAt: null,
    createdAt: startedAt,
    voidedAt: null,
    voidReason: null,
    ...extra,
  }
}
const validated = { validated: true, validatedAt: '2026-09-30T15:00:00.000Z' }

const entries: TimeEntry[] = [
  // P1: sin origen (cuenta completo el día de inicio); validado y no pagado.
  entry('P1', '2026-09-05T15:00:00.000Z', 10, validated),
  // P1: reloj que cruza el corte de mes en Lima (23:00 del 30/09 a 02:00 del 01/10): 1 h en septiembre, 2 h en octubre.
  entry('P1', '2026-10-01T04:00:00.000Z', 3, {
    source: 'timer',
    segments: [{ start: '2026-10-01T04:00:00.000Z', end: '2026-10-01T07:00:00.000Z' }],
  }),
  // P1: anulado, no cuenta en nada.
  entry('P1', '2026-09-07T15:00:00.000Z', 8, {
    voidedAt: '2026-09-08T00:00:00.000Z',
    voidReason: 'Error',
  }),
  // P2: pagado (horas sí, puntos no), pendiente (horas sí, puntos no), borrador (nada), y dos validados.
  entry('P2', '2026-09-10T15:00:00.000Z', 12, { ...validated, paid: true }),
  entry('P2', '2026-09-20T15:00:00.000Z', 4),
  entry('P2', '2026-09-22T15:00:00.000Z', 5, { draft: true, source: 'timer' }),
  entry('P2', '2026-09-25T15:00:00.000Z', 24, validated),
  entry('P2', '2026-09-26T15:00:00.000Z', 24, validated),
  // P3: reloj con dos segmentos y horas confirmadas distintas a lo medido (2.5 de 3 h): se prorratea.
  entry('P3', '2026-09-12T14:00:00.000Z', 2.5, {
    ...validated,
    source: 'timer',
    endedAt: '2026-09-13T15:00:00.000Z',
    segments: [
      { start: '2026-09-12T14:00:00.000Z', end: '2026-09-12T16:00:00.000Z' },
      { start: '2026-09-13T14:00:00.000Z', end: '2026-09-13T15:00:00.000Z' },
    ],
  }),
  // C (colaborador): sus horas no entran en el reparto.
  entry('C', '2026-09-15T15:00:00.000Z', 40, validated),
]

const expenses: Pick<Expense, 'paidBy' | 'amount' | 'currency' | 'status' | 'reimbursed' | 'beforeSigning'>[] = [
  { paidBy: 'P1', amount: 35, currency: 'PEN', status: 'approved', reimbursed: false, beforeSigning: false },
  { paidBy: 'P1', amount: 120, currency: 'PEN', status: 'approved', reimbursed: true, beforeSigning: false },
  { paidBy: 'P2', amount: 100, currency: 'PEN', status: 'approved', reimbursed: false, beforeSigning: true },
  { paidBy: 'P3', amount: 90, currency: 'PEN', status: 'pending', reimbursed: false, beforeSigning: false },
  { paidBy: 'P4', amount: 13, currency: 'USD', status: 'approved', reimbursed: false, beforeSigning: false },
  { paidBy: 'P4', amount: 80, currency: 'PEN', status: 'approved', reimbursed: false, beforeSigning: false },
  { paidBy: 'P3', amount: 60, currency: 'PEN', status: 'voided', reimbursed: false, beforeSigning: false },
]

function summarize(month: string) {
  return members.map((m) => {
    const hours = monthlyActivity(
      entries.filter((e) => e.userId === m.id),
      month,
    ).total
    const reduced = absences
      .filter((a) => a.userId === m.id && a.from.slice(0, 7) === month)
      .reduce((sum, a) => sum + a.reducedHours, 0)
    const minimumHours = monthlyMinimum(m.weeklyHours, settings, reduced)
    const { compliance, meetsMinimum } = computeCompliance(hours, minimumHours)
    return { userId: m.id, hours, minimumHours, compliance, meetsMinimum }
  })
}

const round4 = (value: number) => Math.round(value * 10000) / 10000

describe('paridad con las vistas SQL (supabase/tests/04_vistas_paridad.test.sql)', () => {
  it('cumplimiento de septiembre (Lima)', () => {
    const rows = summarize('2026-09').map((r) => ({
      userId: r.userId,
      hours: round4(r.hours),
      minimumHours: r.minimumHours,
      compliance: round4(r.compliance),
      meetsMinimum: r.meetsMinimum,
    }))
    expect(rows).toEqual([
      { userId: 'P1', hours: 11, minimumHours: 48, compliance: 0.2292, meetsMinimum: false },
      { userId: 'P2', hours: 64, minimumHours: 64, compliance: 1, meetsMinimum: true },
      { userId: 'P3', hours: 2.5, minimumHours: 42, compliance: 0.0595, meetsMinimum: false },
      { userId: 'P4', hours: 0, minimumHours: 80, compliance: 0, meetsMinimum: false },
    ])
  })

  it('cumplimiento de octubre: la parte del reloj que cruza el corte y la ausencia de octubre', () => {
    const rows = summarize('2026-10').map((r) => ({
      userId: r.userId,
      hours: round4(r.hours),
      minimumHours: r.minimumHours,
    }))
    expect(rows).toEqual([
      { userId: 'P1', hours: 2, minimumHours: 48 },
      { userId: 'P2', hours: 0, minimumHours: 64 },
      { userId: 'P3', hours: 0, minimumHours: 45 },
      { userId: 'P4', hours: 0, minimumHours: 80 },
    ])
  })

  it('puntos y participación', () => {
    const points = computePoints(
      members.map((m) => ({
        userId: m.id,
        hourPoints: entries
          .filter((e) => e.userId === m.id)
          .reduce((sum, e) => sum + entryPoints(e, settings), 0),
        moneyPoints: expenses
          .filter((e) => e.paidBy === m.id)
          .reduce((sum, e) => sum + expensePoints(e, settings), 0),
      })),
    ).map((p) => ({ ...p, participation: round4(p.participation) }))
    expect(points).toEqual([
      { userId: 'P1', hourPoints: 200, moneyPoints: 70, totalPoints: 270, participation: 0.1875 },
      { userId: 'P2', hourPoints: 960, moneyPoints: 0, totalPoints: 960, participation: 0.6667 },
      { userId: 'P3', hourPoints: 50, moneyPoints: 0, totalPoints: 50, participation: 0.0347 },
      { userId: 'P4', hourPoints: 0, moneyPoints: 160, totalPoints: 160, participation: 0.1111 },
    ])
  })
})
