import type { TimeEntry } from '@/domain/types'
import { todayLima } from '@/lib/dates'

/** Split known intervals at hour boundaries in Lima, clipping to the selected month. */
export function monthlyActivity(entries: TimeEntry[], month: string) {
  const [year, number] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const daily = Array<number>(count).fill(0)
  const hourly = Array<number>(24).fill(0)
  const from = Date.parse(`${month}-01T00:00:00-05:00`)
  const to = Date.UTC(year, number, 1, 5)
  let approved = 0
  let timedHours = 0
  for (const entry of entries) {
    if (entry.voidedAt || !entry.endedAt || entry.hours <= 0) continue
    if (!entry.source) {
      const date = todayLima(new Date(entry.startedAt))
      if (date.startsWith(month)) {
        daily[Number(date.slice(8)) - 1] += entry.hours
        if (entry.validated) approved += entry.hours
      }
      continue
    }
    const start = Date.parse(entry.startedAt)
    const end = Date.parse(entry.endedAt)
    if (end <= start) continue
    const ratio = entry.hours / ((end - start) / 3600000)
    for (let cursor = Math.max(start, from); cursor < Math.min(end, to);) {
      const stop = Math.min((Math.floor(cursor / 3600000) + 1) * 3600000, end, to)
      const hours = (stop - cursor) / 3600000 * ratio
      const local = new Date(cursor - 5 * 3600000)
      daily[local.getUTCDate() - 1] += hours
      hourly[local.getUTCHours()] += hours
      timedHours += hours
      if (entry.validated) approved += hours
      cursor = stop
    }
  }
  return { daily, hourly, approved, timedHours, total: daily.reduce((a,b) => a+b,0), activeDays: daily.filter(h => h > 0).length }
}
