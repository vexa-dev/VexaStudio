import { tz } from '@date-fns/tz'
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

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
