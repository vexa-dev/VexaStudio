import { describe, expect, it } from 'vitest'
import { monthKey } from '@vexa/domain/dates'
import { summarizeMonth, summarizePoints } from './dashboard'

describe('resumen del dashboard (mock)', () => {
  it('calcula el mínimo mensual de cada socio con el PRD', () => {
    const summary = summarizeMonth(monthKey(new Date()))
    expect(summary.map((s) => s.minimumHours)).toEqual([48, 64, 48, 80])
  })

  it('el reparto de participación suma 100 %', () => {
    const points = summarizePoints()
    expect(points).toHaveLength(4)
    const total = points.reduce((sum, p) => sum + p.participation, 0)
    expect(total).toBeCloseTo(1)
    expect(points.every((p) => p.totalPoints === p.hourPoints + p.moneyPoints)).toBe(true)
  })

  it('el gasto previo a la firma y el reembolsado no suman puntos por dinero', () => {
    // En el seed Jhony solo pagó el dominio (previo a la firma, en dólares) y Diego uno reembolsado.
    const points = summarizePoints()
    expect(points.find((p) => p.userId === 'u-jhony')?.moneyPoints).toBe(0)
    expect(points.find((p) => p.userId === 'u-diego')?.moneyPoints).toBe(0)
  })
})
