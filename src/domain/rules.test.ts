import { describe, expect, it } from 'vitest'
import {
  canEditEntry,
  computeCompliance,
  computePoints,
  entryPoints,
  expenseNeedsApproval,
  expensePoints,
  hoursBetween,
  missedMeetingsInARow,
  monthlyMinimum,
  resolveExpenseStatus,
} from './rules'

const settings = {
  pointsPerHour: 20,
  pointsPerSol: 2,
  minCompliance: 0.8,
  weeksPerMonth: 4,
  expenseApprovalLimitPen: 50,
  entryEditDays: 7,
}

describe('entryPoints', () => {
  const base = { hours: 3, paid: false, validated: true, voidedAt: null }
  it('da 20 puntos por hora validada y no pagada', () => {
    expect(entryPoints(base, settings)).toBe(60)
  })
  it('da 0 si no está validada, es pagada o está anulada', () => {
    expect(entryPoints({ ...base, validated: false }, settings)).toBe(0)
    expect(entryPoints({ ...base, paid: true }, settings)).toBe(0)
    expect(entryPoints({ ...base, voidedAt: '2026-09-01T00:00:00Z' }, settings)).toBe(0)
  })
})

describe('expensePoints', () => {
  const base = {
    amount: 100,
    currency: 'PEN' as const,
    status: 'approved' as const,
    reimbursed: false,
    beforeSigning: false,
  }
  it('da 2 puntos por S/ 1 aprobado', () => {
    expect(expensePoints(base, settings)).toBe(200)
  })
  it('da 0 si está reembolsado, es previo a la firma, no está aprobado o no es en soles', () => {
    expect(expensePoints({ ...base, reimbursed: true }, settings)).toBe(0)
    expect(expensePoints({ ...base, beforeSigning: true }, settings)).toBe(0)
    expect(expensePoints({ ...base, status: 'pending' }, settings)).toBe(0)
    expect(expensePoints({ ...base, currency: 'USD' }, settings)).toBe(0)
  })
})

describe('computePoints', () => {
  it('calcula la participación sobre el total', () => {
    const [a, b] = computePoints([
      { userId: 'a', hourPoints: 300, moneyPoints: 100 },
      { userId: 'b', hourPoints: 600, moneyPoints: 0 },
    ])
    expect(a.totalPoints).toBe(400)
    expect(a.participation).toBeCloseTo(0.4)
    expect(b.participation).toBeCloseTo(0.6)
  })
  it('devuelve participación 0 cuando nadie tiene puntos', () => {
    const [a] = computePoints([{ userId: 'a', hourPoints: 0, moneyPoints: 0 }])
    expect(a.participation).toBe(0)
  })
})

describe('monthlyMinimum', () => {
  it.each([
    [15, 48],
    [20, 64],
    [25, 80],
  ])('%i h/semana → %i h al mes', (weekly, expected) => {
    expect(monthlyMinimum(weekly, settings)).toBe(expected)
  })
  it('descuenta las horas de ausencias justificadas sin bajar de 0', () => {
    expect(monthlyMinimum(15, settings, 12)).toBe(36)
    expect(monthlyMinimum(15, settings, 100)).toBe(0)
  })
})

describe('computeCompliance', () => {
  it('cumple con horas iguales o mayores al mínimo', () => {
    expect(computeCompliance(48, 48).meetsMinimum).toBe(true)
    expect(computeCompliance(60, 48).compliance).toBeCloseTo(1.25)
  })
  it('no cumple por debajo del mínimo', () => {
    const r = computeCompliance(24, 48)
    expect(r.meetsMinimum).toBe(false)
    expect(r.compliance).toBeCloseTo(0.5)
  })
  it('con mínimo 0 se considera cumplido', () => {
    expect(computeCompliance(0, 0)).toEqual({ compliance: 1, meetsMinimum: true })
  })
})

describe('gastos', () => {
  it('requiere aprobación solo por encima de S/ 50', () => {
    expect(expenseNeedsApproval(50, settings)).toBe(false)
    expect(expenseNeedsApproval(50.01, settings)).toBe(true)
  })
  it('aprueba sin votos hasta el límite', () => {
    const e = { amount: 50, currency: 'PEN' as const, status: 'pending' as const }
    expect(resolveExpenseStatus(e, [], settings)).toBe('approved')
  })
  it('queda pendiente hasta tener 3 votos a favor', () => {
    const e = { amount: 120, currency: 'PEN' as const, status: 'pending' as const }
    const yes = { inFavor: true }
    expect(resolveExpenseStatus(e, [yes, yes], settings)).toBe('pending')
    expect(resolveExpenseStatus(e, [yes, yes, yes], settings)).toBe('approved')
  })
  it('se rechaza cuando ya no puede alcanzar 3 votos', () => {
    const e = { amount: 120, currency: 'PEN' as const, status: 'pending' as const }
    const no = { inFavor: false }
    expect(resolveExpenseStatus(e, [no], settings)).toBe('pending')
    expect(resolveExpenseStatus(e, [no, no], settings)).toBe('rejected')
  })
  it('un gasto anulado sigue anulado', () => {
    const e = { amount: 10, currency: 'PEN' as const, status: 'voided' as const }
    expect(resolveExpenseStatus(e, [], settings)).toBe('voided')
  })
})

describe('canEditEntry', () => {
  const created = '2026-09-01T12:00:00Z'
  const entry = { createdAt: created, validated: false, voidedAt: null }
  it('permite editar dentro de 7 días', () => {
    expect(canEditEntry(entry, new Date('2026-09-08T12:00:00Z'), settings)).toBe(true)
  })
  it('no permite editar pasados 7 días', () => {
    expect(canEditEntry(entry, new Date('2026-09-08T12:00:01Z'), settings)).toBe(false)
  })
  it('no permite editar si está validado o anulado', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    expect(canEditEntry({ ...entry, validated: true }, now, settings)).toBe(false)
    expect(canEditEntry({ ...entry, voidedAt: created }, now, settings)).toBe(false)
  })
})

describe('hoursBetween', () => {
  it('calcula horas con 2 decimales', () => {
    expect(hoursBetween('2026-09-01T14:00:00Z', '2026-09-01T15:30:00Z')).toBe(1.5)
    expect(hoursBetween('2026-09-01T14:00:00Z', '2026-09-01T14:20:00Z')).toBe(0.33)
  })
  it('no devuelve horas negativas', () => {
    expect(hoursBetween('2026-09-01T15:00:00Z', '2026-09-01T14:00:00Z')).toBe(0)
  })
})

describe('missedMeetingsInARow', () => {
  const held = (week: string, attendeeIds: string[]) => ({ status: 'held' as const, week, attendeeIds })
  it('cuenta las ausencias seguidas desde la reunión más reciente', () => {
    const meetings = [held('2026-09-07', ['a', 'b']), held('2026-09-14', ['a']), held('2026-09-21', ['a'])]
    expect(missedMeetingsInARow(meetings, 'b')).toBe(2)
  })
  it('una asistencia corta la racha', () => {
    const meetings = [held('2026-09-07', ['a']), held('2026-09-14', ['a', 'b']), held('2026-09-21', ['a'])]
    expect(missedMeetingsInARow(meetings, 'b')).toBe(1)
  })
  it('ignora las reuniones que no se realizaron', () => {
    const meetings = [held('2026-09-14', ['a']), { status: 'polling' as const, week: '2026-09-21', attendeeIds: [] }]
    expect(missedMeetingsInARow(meetings, 'b')).toBe(1)
  })
})
