import { tz } from '@date-fns/tz'
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'

/** Zona horaria del negocio (UTC-5, sin horario de verano). */
export const LIMA_TZ = 'America/Lima'

const inLima = { in: tz(LIMA_TZ) }

/** Los cortes de semana empiezan el lunes. */
const WEEK_OPTIONS = { ...inLima, weekStartsOn: 1 as const }

/** `dd/mm/yyyy` en hora de Lima. */
export function formatDate(value: Date | string): string {
  return format(value, 'dd/MM/yyyy', inLima)
}

/** `dd/mm/yyyy HH:mm` en hora de Lima. */
export function formatDateTime(value: Date | string): string {
  return format(value, 'dd/MM/yyyy HH:mm', inLima)
}

/** Fecha de hoy en Lima como `YYYY-MM-DD`. */
export function todayLima(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd', inLima)
}

/** Mes en Lima como `YYYY-MM`. */
export function monthKey(value: Date | string): string {
  return format(value, 'yyyy-MM', inLima)
}

/** Rango `[inicio, fin]` (instantes UTC) del mes de Lima que contiene `value`. */
export function monthRange(value: Date | string): { start: Date; end: Date } {
  return {
    start: new Date(startOfMonth(value, inLima).getTime()),
    end: new Date(endOfMonth(value, inLima).getTime()),
  }
}

/** Rango `[inicio, fin]` (instantes UTC) de la semana de Lima (lunes a domingo). */
export function weekRange(value: Date | string): { start: Date; end: Date } {
  return {
    start: new Date(startOfWeek(value, WEEK_OPTIONS).getTime()),
    end: new Date(endOfWeek(value, WEEK_OPTIONS).getTime()),
  }
}

/** Etiqueta de un mes `YYYY-MM`: `Septiembre 2026`. */
export function formatMonthLabel(month: string): string {
  const label = format(new Date(`${month}-15T12:00:00Z`), 'LLLL yyyy', { ...inLima, locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** `dd/mm/yyyy` de una fecha sin hora (`YYYY-MM-DD`). No pasa por zonas horarias: ya es fecha de Lima. */
export function formatIsoDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

/** Encabezado de un día: `Lunes 28/09`, en hora de Lima. */
export function formatDayHeading(value: Date | string): string {
  const label = format(value, 'EEEE dd/MM', { ...inLima, locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Días de calendario entre hoy (Lima) y una fecha `YYYY-MM-DD`. Negativo si ya pasó. */
export function daysUntil(date: string, now: Date = new Date()): number {
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
  return Math.round((day(date) - day(todayLima(now))) / (24 * 60 * 60 * 1000))
}
