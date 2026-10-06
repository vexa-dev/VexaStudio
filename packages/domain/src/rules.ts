import { pointsCredit } from './hours-credit'
import type {
  Expense,
  ExpenseStatus,
  ExpenseVote,
  Id,
  MemberPoints,
  Settings,
  TimeEntry,
} from './types'

/** Votos a favor necesarios para aprobar un gasto que supera el límite (3 de 4). */
export const EXPENSE_VOTES_REQUIRED = 3

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Puntos de un registro de horas: solo horas no pagadas, validadas y no anuladas. Con `userId` se
 * calculan los de esa persona (dueño al 100 %, persona etiquetada a su porcentaje); sin él, los del dueño.
 */
export function entryPoints(
  entry: Pick<TimeEntry, 'hours' | 'paid' | 'validated' | 'voidedAt'> &
    Partial<Pick<TimeEntry, 'userId' | 'participants'>>,
  settings: Pick<Settings, 'pointsPerHour'>,
  userId?: Id,
): number {
  if (entry.paid || !entry.validated || entry.voidedAt) return 0
  if (userId === undefined) return entry.hours * settings.pointsPerHour
  return (
    pointsCredit({ userId: entry.userId ?? userId, ...entry }, userId) * settings.pointsPerHour
  )
}

/**
 * Puntos de un gasto: solo si está aprobado, no reembolsado y no es previo a la firma.
 * Solo cuentan los gastos en soles; el PRD no define tipo de cambio.
 */
export function expensePoints(
  expense: Pick<Expense, 'amount' | 'currency' | 'status' | 'reimbursed' | 'beforeSigning'>,
  settings: Pick<Settings, 'pointsPerSol'>,
): number {
  if (expense.currency !== 'PEN') return 0
  if (expense.status !== 'approved' || expense.reimbursed || expense.beforeSigning) return 0
  return expense.amount * settings.pointsPerSol
}

/** Arma el resumen de puntos por socio; la participación es sus puntos entre el total. */
export function computePoints(
  rows: { userId: string; hourPoints: number; moneyPoints: number }[],
): MemberPoints[] {
  const total = rows.reduce((sum, r) => sum + r.hourPoints + r.moneyPoints, 0)
  return rows.map((r) => {
    const totalPoints = r.hourPoints + r.moneyPoints
    return {
      userId: r.userId,
      hourPoints: r.hourPoints,
      moneyPoints: r.moneyPoints,
      totalPoints,
      participation: total === 0 ? 0 : totalPoints / total,
    }
  })
}

/** Mínimo mensual = horas/semana × semanas/mes × % mínimo, menos las horas de ausencias justificadas. */
export function monthlyMinimum(
  weeklyHours: number,
  settings: Pick<Settings, 'weeksPerMonth' | 'minCompliance'>,
  reducedHours = 0,
): number {
  const base = weeklyHours * settings.weeksPerMonth * settings.minCompliance
  return Math.max(0, round2(base - reducedHours))
}

/** Cumplimiento = horas / mínimo. Con mínimo 0 se considera cumplido. */
export function computeCompliance(
  hours: number,
  minimumHours: number,
): { compliance: number; meetsMinimum: boolean } {
  if (minimumHours <= 0) return { compliance: 1, meetsMinimum: true }
  return { compliance: hours / minimumHours, meetsMinimum: hours >= minimumHours }
}

/** Un gasto mayor al límite necesita votación; hasta el límite se aprueba solo. */
export function expenseNeedsApproval(
  amountPen: number,
  settings: Pick<Settings, 'expenseApprovalLimitPen'>,
): boolean {
  return amountPen > settings.expenseApprovalLimitPen
}

/**
 * Estado de un gasto según sus votos. Con `totalVoters` socios, se rechaza cuando ya
 * no es posible llegar a los votos requeridos. Un gasto anulado no cambia de estado.
 */
export function resolveExpenseStatus(
  expense: Pick<Expense, 'amount' | 'currency' | 'status'>,
  votes: Pick<ExpenseVote, 'inFavor'>[],
  settings: Pick<Settings, 'expenseApprovalLimitPen'>,
  totalVoters = 4,
): ExpenseStatus {
  if (expense.status === 'voided') return 'voided'
  // El límite está en soles; un gasto en otra moneda siempre pasa por votación.
  const needsVote = expense.currency !== 'PEN' || expenseNeedsApproval(expense.amount, settings)
  if (!needsVote) return 'approved'
  const inFavor = votes.filter((v) => v.inFavor).length
  const against = votes.length - inFavor
  if (inFavor >= EXPENSE_VOTES_REQUIRED) return 'approved'
  if (against > totalVoters - EXPENSE_VOTES_REQUIRED) return 'rejected'
  return 'pending'
}

/** Un registro propio se edita hasta `entryEditDays` días o y reabre la revisión al editar; nunca si está anulado o pagado. */
export function canEditEntry(
  entry: Pick<TimeEntry, 'createdAt' | 'validated' | 'voidedAt'> & Partial<Pick<TimeEntry, 'paid' | 'reviewNote'>>,
  now: Date,
  settings: Pick<Settings, 'entryEditDays'>,
): boolean {
  if (entry.paid || entry.voidedAt) return false
  if (entry.reviewNote) return true
  const elapsed = now.getTime() - new Date(entry.createdAt).getTime()
  return elapsed <= settings.entryEditDays * MS_PER_DAY
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Horas entre dos instantes ISO, con 2 decimales. Nunca negativas. */
export function hoursBetween(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  return round2(Math.max(ms, 0) / (60 * 60 * 1000))
}
