import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, monthKey, monthRange, todayLima, weekRange } from './dates'
import { formatMoney, formatPen } from './format'

describe('fechas en Lima', () => {
  it('formatea dd/mm/yyyy en hora de Lima', () => {
    // 2027-03-01 03:00 UTC = 2027-02-28 22:00 en Lima
    expect(formatDate('2027-03-01T03:00:00Z')).toBe('28/02/2027')
    expect(formatDateTime('2027-03-01T03:00:00Z')).toBe('28/02/2027 22:00')
  })

  it('corta el mes según Lima, no UTC', () => {
    expect(monthKey('2026-10-01T02:00:00Z')).toBe('2026-09')
    expect(monthKey('2026-10-01T05:00:00Z')).toBe('2026-10')
  })

  it('el rango del mes empieza y termina a medianoche de Lima', () => {
    const { start, end } = monthRange('2026-09-15T12:00:00Z')
    expect(start.toISOString()).toBe('2026-09-01T05:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-01T04:59:59.999Z')
  })

  it('la semana va de lunes a domingo en Lima', () => {
    // Miércoles 30/09/2026
    const { start, end } = weekRange('2026-09-30T15:00:00Z')
    expect(start.toISOString()).toBe('2026-09-28T05:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-05T04:59:59.999Z')
  })

  it('todayLima usa la fecha de Lima', () => {
    expect(todayLima(new Date('2026-09-30T03:00:00Z'))).toBe('2026-09-29')
  })
})

describe('montos', () => {
  it('formatea soles con separador de miles y 2 decimales', () => {
    expect(formatPen(1234.5)).toBe('S/ 1,234.50')
    expect(formatPen(0)).toBe('S/ 0.00')
  })
  it('formatea dólares', () => {
    expect(formatMoney(13, 'USD')).toBe('US$ 13.00')
  })
})
