import { extractMentions } from '@/domain/mentions'
import type { Announcement, DailyUpdate, Meeting, MeetingSlot } from '@/domain/types'
import { todayLima, weekRange } from '@/lib/dates'
import type { AnnouncementService, DailyService, MeetingDetail, MeetingService } from '../types'
import { currentAdmin, currentPartner, currentUser, newId, notify, votingPartners } from './context'
import { getDb, save } from './db'
import { delay } from './utils'

/** Comunicación asíncrona del equipo: daily, anuncios y la convocatoria de la reunión semanal. */

const HOUR_MS = 60 * 60 * 1000

export const daily: DailyService = {
  async list(filter = {}) {
    currentUser()
    return delay(
      getDb()
        .dailyUpdates.filter(
          (d) => (!filter.userId || d.userId === filter.userId) && (!filter.date || d.date === filter.date),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    )
  },
  async submit(input) {
    const user = currentPartner()
    const db = getDb()
    const fields = { done: input.done.trim(), willDo: input.willDo.trim(), blockers: input.blockers.trim() }
    if (!fields.done && !fields.willDo && !fields.blockers) throw new Error('Cuéntale algo al equipo en tu daily')
    const date = todayLima()
    // Un daily por persona y día: si ya envió uno hoy, se actualiza.
    let update = db.dailyUpdates.find((d) => d.userId === user.id && d.date === date)
    if (update) Object.assign(update, fields)
    else {
      update = { id: newId('d'), userId: user.id, date, ...fields } satisfies DailyUpdate
      db.dailyUpdates.push(update)
    }
    // Los bloqueos con @mención avisan a la persona mencionada.
    for (const id of extractMentions(fields.blockers, votingPartners())) {
      if (id !== user.id) {
        notify(id, 'mention', { by: user.id, entity: 'daily', entityId: update.id, excerpt: fields.blockers.slice(0, 80) })
      }
    }
    save()
    return delay(update)
  },
  async suggestDone() {
    const user = currentUser()
    const db = getDb()
    const mine = db.dailyUpdates.filter((d) => d.userId === user.id).sort((a, b) => b.date.localeCompare(a.date))
    // Desde el último daily (sin contar hoy) o, si no hay, los últimos 7 días.
    const today = todayLima()
    const last = mine.find((d) => d.date < today)
    const since = last
      ? new Date(`${last.date}T23:59:59-05:00`).getTime()
      : Date.now() - 7 * 24 * HOUR_MS
    const hoursByTask = new Map<string, number>()
    for (const entry of db.timeEntries) {
      if (entry.userId !== user.id || entry.voidedAt || entry.endedAt === null) continue
      if (new Date(entry.startedAt).getTime() <= since) continue
      hoursByTask.set(entry.taskId, (hoursByTask.get(entry.taskId) ?? 0) + entry.hours)
    }
    const lines = [...hoursByTask.entries()].map(([taskId, hours]) => {
      const title = db.tasks.find((t) => t.id === taskId)?.title ?? 'Tarea'
      return `${title} (${Math.round(hours * 100) / 100} h)`
    })
    return delay(lines.join('\n'))
  },
}

function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
  )
}

export const announcements: AnnouncementService = {
  async list() {
    currentUser()
    return delay(sortAnnouncements(getDb().announcements))
  },
  async create(text) {
    const user = currentPartner()
    if (!text.trim()) throw new Error('Escribe el anuncio')
    const announcement: Announcement = {
      id: newId('a'),
      authorId: user.id,
      text: text.trim(),
      pinned: false,
      createdAt: new Date().toISOString(),
    }
    getDb().announcements.push(announcement)
    save()
    return delay(announcement)
  },
  async setPinned(id, pinned) {
    currentAdmin()
    const announcement = getDb().announcements.find((a) => a.id === id)
    if (!announcement) throw new Error('El anuncio no existe')
    announcement.pinned = pinned
    save()
    return delay(announcement)
  },
}

/** Lunes de la semana actual (Lima) como `YYYY-MM-DD`. */
function currentWeek(now = new Date()): string {
  return todayLima(weekRange(now).start)
}

function detailOf(meeting: Meeting): MeetingDetail {
  const db = getDb()
  const slots = db.meetingSlots.filter((s) => s.meetingId === meeting.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const slotIds = new Set(slots.map((s) => s.id))
  return { meeting, slots, votes: db.slotVotes.filter((v) => slotIds.has(v.slotId)) }
}

function findMeeting(id: string): Meeting {
  const meeting = getDb().meetings.find((m) => m.id === id)
  if (!meeting) throw new Error('La convocatoria no existe')
  return meeting
}

export const meetings: MeetingService = {
  async getCurrent() {
    currentUser()
    const meeting = getDb().meetings.find((m) => m.week === currentWeek() && m.status !== 'cancelled')
    return delay(meeting ? detailOf(meeting) : null)
  },
  async propose(slotStarts) {
    const user = currentAdmin()
    const db = getDb()
    const starts = [...new Set(slotStarts.map((s) => new Date(s).toISOString()))]
    if (starts.length < 2 || starts.length > 3) throw new Error('Propón 2 o 3 horarios distintos')
    if (starts.some((s) => new Date(s).getTime() <= Date.now())) throw new Error('Los horarios deben ser a futuro')
    const week = currentWeek()
    if (db.meetings.some((m) => m.week === week && m.status !== 'cancelled')) {
      throw new Error('Ya hay una convocatoria para esta semana')
    }
    const meeting: Meeting = { id: newId('m'), week, status: 'polling', confirmedSlotId: null, meetLink: null, attendeeIds: [] }
    db.meetings.push(meeting)
    const slots: MeetingSlot[] = starts.map((startsAt) => ({ id: newId('ms'), meetingId: meeting.id, startsAt }))
    db.meetingSlots.push(...slots)
    for (const partner of votingPartners()) {
      if (partner.id !== user.id) notify(partner.id, 'meeting', { kind: 'proposed', meetingId: meeting.id })
    }
    save()
    return delay(detailOf(meeting))
  },
  async vote(slotId, available) {
    const user = currentPartner()
    const db = getDb()
    const slot = db.meetingSlots.find((s) => s.id === slotId)
    if (!slot) throw new Error('El horario no existe')
    const meeting = findMeeting(slot.meetingId)
    if (meeting.status !== 'polling') throw new Error('La convocatoria ya no recibe respuestas')
    const existing = db.slotVotes.find((v) => v.slotId === slotId && v.userId === user.id)
    if (existing) existing.available = available
    else db.slotVotes.push({ slotId, userId: user.id, available })
    save()
    return delay(detailOf(meeting))
  },
  async confirm(meetingId, slotId, meetLink) {
    const user = currentAdmin()
    const db = getDb()
    const meeting = findMeeting(meetingId)
    if (meeting.status !== 'polling') throw new Error('Esta convocatoria ya no se puede confirmar')
    if (!db.meetingSlots.some((s) => s.id === slotId && s.meetingId === meetingId)) throw new Error('Ese horario no es de esta convocatoria')
    if (!/^https:\/\/\S+$/.test(meetLink.trim())) throw new Error('Escribe el enlace de Meet completo (https://…)')
    meeting.status = 'confirmed'
    meeting.confirmedSlotId = slotId
    meeting.meetLink = meetLink.trim()
    for (const partner of votingPartners()) {
      if (partner.id !== user.id) notify(partner.id, 'meeting', { kind: 'confirmed', meetingId })
    }
    save()
    return delay(detailOf(meeting))
  },
  async markAttendance(meetingId, attendeeIds) {
    currentAdmin()
    const meeting = findMeeting(meetingId)
    if (meeting.status !== 'confirmed') throw new Error('Solo se marca la asistencia de una reunión confirmada')
    const partnerIds = new Set(votingPartners().map((p) => p.id))
    if (attendeeIds.some((id) => !partnerIds.has(id))) throw new Error('Hay asistentes que no son socios')
    meeting.attendeeIds = [...new Set(attendeeIds)]
    meeting.status = 'held'
    save()
    return delay(detailOf(meeting))
  },
  async listPast() {
    currentUser()
    return delay(
      getDb()
        .meetings.filter((m) => m.status === 'held')
        .sort((a, b) => b.week.localeCompare(a.week)),
    )
  },
}
