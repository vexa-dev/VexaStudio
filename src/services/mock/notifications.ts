import type { Profile } from '@/domain/types'
import { daysUntil, limaTime, limaWeekday, todayLima, weekRange } from '@/lib/dates'
import type { NotificationService } from '../types'
import { currentUser, notify } from './context'
import { getDb, save } from './db'
import { delay } from './utils'

/**
 * Recordatorios programados. En la etapa 2 los generan pg_cron y Edge Functions; en el mock se
 * materializan al pedir la bandeja, con ids fijos para que cada uno aparezca una sola vez.
 */
export function syncReminders(user: Profile, now: Date): void {
  if (user.role === 'collaborator') return
  const db = getDb()
  const { dailyReminder, weeklyHoursReminder } = db.settings
  const today = todayLima(now)
  const time = limaTime(now)
  const weekday = limaWeekday(now)

  // Daily: lunes, miércoles y viernes desde las 9:00 p. m., si aún no lo envió.
  if (
    dailyReminder.weekdays.includes(weekday) &&
    time >= dailyReminder.time &&
    !db.dailyUpdates.some((d) => d.userId === user.id && d.date === today)
  ) {
    notify(user.id, 'daily_pending', { date: today }, `rem-daily-${today}-${user.id}`)
  }

  // Horas de la semana: el domingo desde las 8:00 p. m., si no llega a lo comprometido.
  if (weekday === weeklyHoursReminder.weekday && time >= weeklyHoursReminder.time) {
    const { start, end } = weekRange(now)
    const logged = db.timeEntries
      .filter(
        (e) =>
          e.userId === user.id &&
          !e.voidedAt &&
          new Date(e.startedAt) >= start &&
          new Date(e.startedAt) <= end,
      )
      .reduce((sum, e) => sum + e.hours, 0)
    if (logged < user.weeklyHours) {
      notify(user.id, 'hours_missing', { week: todayLima(start) }, `rem-hours-${todayLima(start)}-${user.id}`)
    }
  }

  // Renovaciones: aviso a los 30 y a los 7 días.
  for (const item of db.recurringExpenses) {
    const days = daysUntil(item.nextDate, now)
    if (days < 0 || days > 30) continue
    const threshold = days <= 7 ? 7 : 30
    notify(
      user.id,
      'renewal',
      { recurringId: item.id, concept: item.concept, days: String(days), threshold: String(threshold) },
      `rem-renewal-${item.id}-${item.nextDate}-${threshold}-${user.id}`,
    )
  }

  // Convocatoria abierta sin respuesta.
  for (const meeting of db.meetings.filter((m) => m.status === 'polling')) {
    const slotIds = new Set(db.meetingSlots.filter((s) => s.meetingId === meeting.id).map((s) => s.id))
    const answered = db.slotVotes.some((v) => v.userId === user.id && slotIds.has(v.slotId))
    if (!answered && user.role !== 'admin') {
      notify(user.id, 'meeting', { kind: 'pending_vote', meetingId: meeting.id }, `rem-meeting-${meeting.id}-${user.id}`)
    }
  }
}

export const notifications: NotificationService = {
  async list() {
    const user = currentUser()
    syncReminders(user, new Date())
    save()
    return delay(
      getDb()
        .notifications.filter((n) => n.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },
  async markRead(id) {
    const user = currentUser()
    const notification = getDb().notifications.find((n) => n.id === id && n.userId === user.id)
    if (notification) notification.read = true
    save()
    return delay(undefined)
  },
  async markAllRead() {
    const user = currentUser()
    for (const n of getDb().notifications) if (n.userId === user.id) n.read = true
    save()
    return delay(undefined)
  },
}
