import { describe, expect, it } from 'vitest'
import { monthlyMinimum } from '@vexa/domain/rules'
import { buildSeed } from './seed'
import { notImplemented } from './utils'

const db = buildSeed(new Date('2026-09-29T15:00:00Z'))

describe('seed', () => {
  it('trae a los 4 socios con el mínimo mensual del PRD', () => {
    const minimums = db.profiles.map((p) => monthlyMinimum(p.weeklyHours, db.settings))
    expect(minimums).toEqual([48, 64, 48, 80])
  })

  it('tiene tareas en todas las columnas y un solo sprint activo', () => {
    expect(new Set(db.tasks.map((t) => t.status))).toEqual(new Set(['todo', 'in_progress', 'review', 'done']))
    expect(db.sprints.filter((s) => s.status === 'active')).toHaveLength(1)
  })

  it('mantiene referencias válidas entre tablas', () => {
    const taskIds = new Set(db.tasks.map((t) => t.id))
    const userIds = new Set(db.profiles.map((p) => p.id))
    expect(db.timeEntries.every((e) => (e.taskId !== null && taskIds.has(e.taskId ?? "")) && userIds.has(e.userId))).toBe(true)
    expect(db.expenseVotes.every((v) => db.expenses.some((e) => e.id === v.expenseId))).toBe(true)
  })

  it('incluye gastos en distintos estados y el dominio previo a la firma', () => {
    expect(new Set(db.expenses.map((e) => e.status))).toEqual(new Set(['pending', 'approved', 'rejected']))
    expect(db.recurringExpenses[0]).toMatchObject({ amount: 13, currency: 'USD', nextDate: '2027-02-23', beforeSigning: true })
  })
})

describe('notImplemented', () => {
  it('rechaza con un mensaje claro', async () => {
    const svc = notImplemented<{ list(): Promise<void> }>('TaskService')
    await expect(svc.list()).rejects.toThrow('TaskService.list')
  })
})
