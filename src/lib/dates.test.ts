import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatIsoDate, daysUntil, formatMonthLabel, monthKey, monthRange, todayLima, weekRange } from './dates'
import { formatClock, formatMoney, formatPen } from './format'

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

describe('etiqueta de mes', () => {
  it('escribe el mes en español con mayúscula inicial', () => {
    expect(formatMonthLabel('2026-09')).toBe('Septiembre 2026')
    expect(formatMonthLabel('2027-02')).toBe('Febrero 2027')
  })
})

describe('fechas sin hora', () => {
  it('formatea YYYY-MM-DD sin desplazarla por zona horaria', () => {
    expect(formatIsoDate('2026-09-01')).toBe('01/09/2026')
    expect(formatIsoDate('2027-02-23')).toBe('23/02/2027')
  })
})

describe('reloj del temporizador', () => {
  it('formatea la duración como h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00:00')
    expect(formatClock(65_000)).toBe('0:01:05')
    expect(formatClock(3_725_000)).toBe('1:02:05')
    expect(formatClock(-500)).toBe('0:00:00')
  })
})

describe('días hasta una fecha', () => {
  it('cuenta días de calendario desde hoy en Lima', () => {
    // 2027-01-24 03:00 UTC = 2027-01-23 22:00 en Lima
    const now = new Date('2027-01-24T03:00:00Z')
    expect(daysUntil('2027-02-23', now)).toBe(31)
    expect(daysUntil('2027-01-23', now)).toBe(0)
    expect(daysUntil('2027-01-20', now)).toBe(-3)
  })
})
