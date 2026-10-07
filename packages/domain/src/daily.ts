import { todayLima } from './dates'
import type { DailyUpdate, Id, IsoDate, IsoDateTime, Task, TimeEntry } from './types'

/** Máximo de caracteres por campo del daily (el mismo tope que la base). */
export const DAILY_MAX_LENGTH = 2000

/** Daily tal como lo devuelven los servicios: con la hora del último envío cuando existe. */
export interface DailyRecord extends DailyUpdate {
  updatedAt?: IsoDateTime
}

export interface DailyFields {
  done: string
  willDo: string
  blockers: string
}

const GENERIC_LABEL = 'Trabajo del estudio'
const LOOKBACK_DAYS = 7

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim().slice(0, DAILY_MAX_LENGTH).trim()
}

/** Recorta, unifica saltos de línea y respeta el tope de cada campo. */
export function normalizeDailyInput(input: DailyFields): DailyFields {
  return {
    done: normalizeText(input.done),
    willDo: normalizeText(input.willDo),
    blockers: normalizeText(input.blockers),
  }
}

/** Mensaje de error para mostrar, o `null` si el daily se puede enviar. */
export function validateDailyInput(input: DailyFields): string | null {
  const { done, willDo } = normalizeDailyInput(input)
  return done || willDo ? null : 'Cuenta qué hiciste o qué harás para enviar tu daily.'
}

/**
 * Una sola fila por persona y fecha: si ya existe se corrige (conserva el id), si no se crea.
 * No modifica la lista recibida.
 */
export function upsertDailyUpdate(
  updates: readonly DailyRecord[],
  userId: Id,
  date: IsoDate,
  input: DailyFields,
  newId: Id,
  nowIso: IsoDateTime,
): { updates: DailyRecord[]; update: DailyRecord } {
  const fields = normalizeDailyInput(input)
  const current = updates.find((u) => u.userId === userId && u.date === date)
  const update: DailyRecord = { ...current, id: current?.id ?? newId, userId, date, ...fields, updatedAt: nowIso }
  return {
    update,
    updates: current ? updates.map((u) => (u === current ? update : u)) : [...updates, update],
  }
}

function shiftIsoDate(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function entryLabels(entry: TimeEntry, tasks: readonly Task[]): string[] {
  const allocated = (entry.allocations ?? []).map((a) => a.title.trim()).filter(Boolean)
  if (allocated.length) return allocated
  const title = tasks.find((t) => t.id === entry.taskId)?.title.trim()
  return [title || entry.description?.trim() || GENERIC_LABEL]
}

/**
 * "Qué hice" a partir de las horas de la persona desde su último daily: cuenta lo trabajado después
 * de esa fecha (Lima) y siempre el día de hoy; sin daily previo mira los últimos 7 días. Una línea
 * por tarea o actividad, sin repetir, en el orden en que se trabajó.
 */
export function buildDoneSuggestion(input: {
  userId: Id
  today: IsoDate
  entries: readonly TimeEntry[]
  tasks: readonly Task[]
  dailies: readonly DailyUpdate[]
}): string {
  const { userId, today } = input
  const last = input.dailies
    .filter((d) => d.userId === userId && d.date <= today)
    .map((d) => d.date)
    .sort()
    .at(-1)
  const since = last ?? shiftIsoDate(today, -(LOOKBACK_DAYS - 1))
  const lines = new Set<string>()
  const worked = input.entries
    .filter((e) => e.userId === userId && !e.voidedAt && !e.draft && e.endedAt)
    .map((e) => ({ e, day: todayLima(new Date(e.startedAt)) }))
    .filter(({ day }) => day <= today && (last ? day > since || day === today : day >= since))
    .sort((a, b) => a.e.startedAt.localeCompare(b.e.startedAt))
  for (const { e } of worked) for (const label of entryLabels(e, input.tasks)) lines.add(`• ${label}`)
  const text: string[] = []
  let length = 0
  for (const line of lines) {
    length += line.length + (text.length ? 1 : 0)
    if (length > DAILY_MAX_LENGTH) break
    text.push(line)
  }
  return text.join('\n')
}
