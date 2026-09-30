import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, resetMock, setSessionUserId } from './db'
import { comments, expenses } from './expenses'
import { notifications, syncReminders } from './notifications'
import { announcements, daily, meetings } from './team'

const JHONY = 'u-jhony' // admin
const ROBER = 'u-rober'
const JOSE = 'u-jose'
const DIEGO = 'u-diego'

const as = (userId: string) => setSessionUserId(userId)
const profile = (id: string) => getDb().profiles.find((p) => p.id === id)!
const inbox = (userId: string) => getDb().notifications.filter((n) => n.userId === userId)
const inDays = (days: number, hourUtc = 1) => new Date(Date.now() + days * 86_400_000 + hourUtc * 3_600_000).toISOString()

beforeEach(() => {
  resetMock()
  as(ROBER)
})

describe('daily', () => {
  it('exige contar algo y guarda un solo daily por persona y día', async () => {
    await expect(daily.submit({ done: ' ', willDo: '', blockers: '' })).rejects.toThrow('Cuéntale algo')
    const first = await daily.submit({ done: 'Reglas', willDo: 'Tests', blockers: '' })
    const second = await daily.submit({ done: 'Reglas y tests', willDo: 'Kanban', blockers: '' })
    expect(second.id).toBe(first.id)
    expect((await daily.list({ userId: ROBER, date: first.date })).length).toBe(1)
  })

  it('un bloqueo con @mención avisa a la persona mencionada y no a quien lo escribe', async () => {
    const before = inbox(DIEGO).length
    await daily.submit({ done: '', willDo: '', blockers: 'Espero el logo final @Diego y @Rober' })
    expect(inbox(DIEGO).length).toBe(before + 1)
    expect(inbox(DIEGO).at(-1)).toMatchObject({ type: 'mention', payload: { by: ROBER, entity: 'daily' } })
    expect(inbox(ROBER).some((n) => n.payload.entity === 'daily')).toBe(false)
  })

  it('sugiere "qué hice" con las tareas trabajadas desde el último daily', async () => {
    const suggestion = await daily.suggestDone()
    expect(suggestion).toContain('h)')
    expect(suggestion.split('\n').length).toBeGreaterThan(0)
  })
})

describe('anuncios', () => {
  it('fija solo el product owner y los fijados van primero', async () => {
    const created = await announcements.create('Recuerden validar sus horas')
    await expect(announcements.setPinned(created.id, true)).rejects.toThrow('product owner')
    as(JHONY)
    await announcements.setPinned(created.id, true)
    const list = await announcements.list()
    expect(list[0].id).toBe(created.id)
    expect(list.filter((a) => a.pinned).length).toBeGreaterThanOrEqual(1)
    await expect(announcements.create('  ')).rejects.toThrow('Escribe el anuncio')
  })
})

describe('reunión semanal', () => {
  const cancelSeedMeeting = () => {
    getDb().meetings.find((m) => m.id === 'm-1')!.status = 'cancelled'
  }

  it('solo el product owner propone, con 2 o 3 horarios a futuro', async () => {
    cancelSeedMeeting()
    await expect(meetings.propose([inDays(1), inDays(2)])).rejects.toThrow('product owner')
    as(JHONY)
    await expect(meetings.propose([inDays(1)])).rejects.toThrow('2 o 3')
    await expect(meetings.propose([inDays(-1), inDays(2)])).rejects.toThrow('a futuro')
    const detail = await meetings.propose([inDays(1), inDays(2), inDays(3)])
    expect(detail.meeting.status).toBe('polling')
    expect(detail.slots).toHaveLength(3)
    // Los demás socios reciben el aviso; quien convoca no.
    expect(inbox(ROBER).some((n) => n.type === 'meeting' && n.payload.kind === 'proposed')).toBe(true)
    expect(inbox(JHONY).some((n) => n.payload.kind === 'proposed')).toBe(false)
  })

  it('no permite dos convocatorias en la misma semana', async () => {
    as(JHONY)
    await expect(meetings.propose([inDays(1), inDays(2)])).rejects.toThrow('Ya hay una convocatoria')
  })

  it('los socios marcan disponibilidad y el product owner confirma con enlace y marca asistencia', async () => {
    const current = (await meetings.getCurrent())!
    const slot = current.slots[0]
    const voted = await meetings.vote(slot.id, true)
    expect(voted.votes.some((v) => v.userId === ROBER && v.available)).toBe(true)

    await expect(meetings.confirm(current.meeting.id, slot.id, 'https://meet.google.com/x')).rejects.toThrow('product owner')
    as(JHONY)
    await expect(meetings.confirm(current.meeting.id, slot.id, 'meet.google.com/x')).rejects.toThrow('https')
    const confirmed = await meetings.confirm(current.meeting.id, slot.id, 'https://meet.google.com/abc-defg-hij')
    expect(confirmed.meeting).toMatchObject({ status: 'confirmed', confirmedSlotId: slot.id })
    expect(inbox(JOSE).some((n) => n.payload.kind === 'confirmed')).toBe(true)
    await expect(meetings.vote(slot.id, false)).rejects.toThrow('ya no recibe')

    const held = await meetings.markAttendance(current.meeting.id, [JHONY, ROBER])
    expect(held.meeting).toMatchObject({ status: 'held', attendeeIds: [JHONY, ROBER] })
    expect((await meetings.listPast()).map((m) => m.id)).toContain(current.meeting.id)
  })
})

describe('notificaciones', () => {
  it('un comentario con @mención avisa a la persona mencionada', async () => {
    const comment = await comments.add({ entity: 'task', entityId: 't-5', text: '¿Lo revisas @José?' })
    expect(comment.mentions).toEqual([JOSE])
    expect(inbox(JOSE).at(-1)).toMatchObject({ type: 'mention', payload: { by: ROBER, entityId: 't-5' } })
  })

  it('un gasto que necesita votos avisa a los demás y el resultado llega a quien pagó', async () => {
    as(JHONY)
    const expense = await expenses.create({
      amount: 120,
      currency: 'PEN',
      concept: 'Prueba',
      category: 'software',
      receiptUrl: null,
    })
    for (const id of [ROBER, JOSE, DIEGO]) {
      expect(inbox(id).some((n) => n.type === 'expense_vote' && n.payload.expenseId === expense.id)).toBe(true)
    }
    for (const voter of [ROBER, JOSE, DIEGO]) {
      as(voter)
      await expenses.vote(expense.id, true)
    }
    expect(inbox(JHONY).some((n) => n.type === 'expense_result' && n.payload.status === 'approved')).toBe(true)
  })

  it('marca como leídas una o todas, solo las propias', async () => {
    await comments.add({ entity: 'task', entityId: 't-5', text: '@Diego mira esto' })
    as(DIEGO)
    const list = await notifications.list()
    const unread = list.filter((n) => !n.read)
    expect(unread.length).toBeGreaterThan(0)
    await notifications.markRead(unread[0].id)
    expect((await notifications.list()).find((n) => n.id === unread[0].id)?.read).toBe(true)
    await notifications.markAllRead()
    expect((await notifications.list()).every((n) => n.read)).toBe(true)
  })
})

describe('recordatorios programados', () => {
  const remindersOf = (userId: string, type: string) => inbox(userId).filter((n) => n.type === type && n.id.startsWith('rem-'))

  it('el daily se recuerda lunes, miércoles y viernes desde las 9:00 p. m. si no lo envió', () => {
    getDb().dailyUpdates.length = 0
    syncReminders(profile(ROBER), new Date('2026-09-29T01:00:00Z')) // lunes 8:00 p. m. Lima: aún no
    expect(remindersOf(ROBER, 'daily_pending')).toHaveLength(0)
    syncReminders(profile(ROBER), new Date('2026-09-29T03:00:00Z')) // lunes 10:00 p. m. Lima
    expect(remindersOf(ROBER, 'daily_pending')).toHaveLength(1)
    syncReminders(profile(ROBER), new Date('2026-09-29T03:30:00Z')) // no se repite
    expect(remindersOf(ROBER, 'daily_pending')).toHaveLength(1)
    syncReminders(profile(ROBER), new Date('2026-09-30T03:00:00Z')) // martes: no toca
    expect(remindersOf(ROBER, 'daily_pending')).toHaveLength(1)
  })

  it('no recuerda el daily a quien ya lo envió ese día', () => {
    getDb().dailyUpdates.length = 0
    getDb().dailyUpdates.push({ id: 'd-x', userId: ROBER, date: '2026-09-28', done: 'a', willDo: 'b', blockers: '' })
    syncReminders(profile(ROBER), new Date('2026-09-29T03:00:00Z'))
    expect(remindersOf(ROBER, 'daily_pending')).toHaveLength(0)
  })

  it('el domingo desde las 8:00 p. m. recuerda las horas si no llegó a lo comprometido', () => {
    getDb().timeEntries.length = 0
    syncReminders(profile(ROBER), new Date('2026-10-05T01:30:00Z')) // domingo 8:30 p. m. Lima
    expect(remindersOf(ROBER, 'hours_missing')).toHaveLength(1)
  })

  it('avisa la renovación a los 30 días y otra vez a los 7', () => {
    syncReminders(profile(JHONY), new Date('2027-02-01T15:00:00Z')) // faltan 22 días
    expect(remindersOf(JHONY, 'renewal').map((n) => n.payload.threshold)).toEqual(['30'])
    syncReminders(profile(JHONY), new Date('2027-02-20T15:00:00Z')) // faltan 3 días
    expect(remindersOf(JHONY, 'renewal').map((n) => n.payload.threshold)).toEqual(['30', '7'])
  })

  it('recuerda responder la convocatoria abierta a quien no votó', () => {
    syncReminders(profile(JOSE), new Date())
    expect(remindersOf(JOSE, 'meeting')).toHaveLength(1)
    // Rober ya votó en la convocatoria del seed.
    syncReminders(profile(ROBER), new Date())
    expect(remindersOf(ROBER, 'meeting')).toHaveLength(0)
  })
})
