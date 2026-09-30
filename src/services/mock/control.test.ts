import { beforeEach, describe, expect, it } from 'vitest'
import { summarizePoints } from './dashboard'
import { getDb, resetMock, setSessionUserId } from './db'
import { comments, expenses } from './expenses'
import { sprints, time } from './work'

const JHONY = 'u-jhony' // admin
const ROBER = 'u-rober'
const JOSE = 'u-jose'
const DIEGO = 'u-diego'

const as = (userId: string) => setSessionUserId(userId)
const newExpense = (amount: number, currency: 'PEN' | 'USD' = 'PEN') =>
  expenses.create({ amount, currency, concept: 'Prueba', category: 'software', receiptUrl: null })
const pointsOf = (userId: string) => summarizePoints().find((p) => p.userId === userId)!

beforeEach(() => {
  resetMock()
  as(JHONY)
})

describe('aprobación de gastos', () => {
  it('hasta S/ 50 se aprueba solo y por encima queda pendiente', async () => {
    expect((await newExpense(50)).status).toBe('approved')
    expect((await newExpense(50.01)).status).toBe('pending')
  })

  it('un gasto en dólares siempre pasa por votación', async () => {
    expect((await newExpense(10, 'USD')).status).toBe('pending')
  })

  it('con el tercer voto a favor se aprueba', async () => {
    // e-2 (S/ 180, de Diego) ya tiene los votos de Jhony y Rober.
    as(JOSE)
    const result = await expenses.vote('e-2', true)
    expect(result.status).toBe('approved')
  })

  it('se rechaza cuando ya no puede llegar a 3 votos a favor', async () => {
    as(JOSE)
    await expenses.vote('e-2', false)
    // Jhony y Rober habían votado a favor: cambian a en contra y ya no alcanza.
    as(JHONY)
    expect((await expenses.vote('e-2', false)).status).toBe('rejected')
  })

  it('quien cambia su voto no cuenta dos veces', async () => {
    as(JOSE)
    await expenses.vote('e-2', false)
    const votes = await expenses.listVotes('e-2')
    expect(votes.filter((v) => v.userId === JOSE)).toHaveLength(1)
    expect((await expenses.list()).find((e) => e.id === 'e-2')?.status).toBe('pending')
  })

  it('no se vota un gasto que ya no está pendiente', async () => {
    await expect(expenses.vote('e-3', true)).rejects.toThrow('ya no está pendiente')
  })

  it('solo quien lo registró puede anularlo, y con motivo', async () => {
    as(ROBER)
    await expect(expenses.void('e-2', 'Duplicado')).rejects.toThrow('Solo quien registró')
    as(DIEGO)
    await expect(expenses.void('e-2', ' ')).rejects.toThrow('motivo')
    expect((await expenses.void('e-2', 'Lo pagó otra persona')).status).toBe('voided')
  })

  it('un gasto aprobado suma 2 puntos por sol al que lo pagó', async () => {
    const before = pointsOf(JHONY).moneyPoints
    const expense = await newExpense(100)
    for (const voter of [ROBER, JOSE, DIEGO]) {
      as(voter)
      await expenses.vote(expense.id, true)
    }
    expect(pointsOf(JHONY).moneyPoints).toBe(before + 200)
  })
})

describe('validación de horas', () => {
  it('validar las horas de otro socio las cuenta para los puntos', async () => {
    const before = pointsOf(DIEGO).hourPoints
    const entry = getDb().timeEntries.find((e) => e.userId === DIEGO && !e.validated && e.endedAt && !e.paid)!
    as(ROBER)
    const [validated] = await time.validate([entry.id])
    expect(validated).toMatchObject({ validated: true })
    expect(pointsOf(DIEGO).hourPoints).toBe(before + entry.hours * 20)
  })

  it('no permite validar las propias horas ni validar dos veces', async () => {
    const own = getDb().timeEntries.find((e) => e.userId === ROBER && !e.validated)!
    as(ROBER)
    await expect(time.validate([own.id])).rejects.toThrow('propias')
    const other = getDb().timeEntries.find((e) => e.userId === DIEGO && !e.validated)!
    await time.validate([other.id])
    await expect(time.validate([other.id])).rejects.toThrow('ya está validado')
  })

  it('si un registro falla no se valida ninguno', async () => {
    as(ROBER)
    const ok = getDb().timeEntries.find((e) => e.userId === DIEGO && !e.validated)!
    const own = getDb().timeEntries.find((e) => e.userId === ROBER && !e.validated)!
    await expect(time.validate([ok.id, own.id])).rejects.toThrow()
    expect(getDb().timeEntries.find((e) => e.id === ok.id)?.validated).toBe(false)
  })

  it('un registro validado queda bloqueado para su dueño', async () => {
    const entry = getDb().timeEntries.find((e) => e.userId === DIEGO && !e.validated && e.endedAt)!
    as(ROBER)
    await time.validate([entry.id])
    as(DIEGO)
    await expect(time.update(entry.id, { hours: 1 })).rejects.toThrow('ya no se puede editar')
    await expect(time.void(entry.id, 'Error')).rejects.toThrow('validado')
  })
})

describe('cierre de sprint', () => {
  it('la revisión compara lo comprometido con lo entregado por socio', async () => {
    const review = await sprints.getReview('s-2')
    expect(review.members).toHaveLength(4)
    const rober = review.members.find((m) => m.userId === ROBER)!
    expect(rober.tasksAssigned).toBe(2) // t-3 (hecha) y t-5 (en progreso)
    expect(rober.tasksDone).toBe(1)
    expect(rober.validatedHours).toBeLessThanOrEqual(rober.loggedHours)
    expect(review.entries.every((e) => !e.voidedAt && e.endedAt !== null)).toBe(true)
  })

  it('solo el product owner cierra el sprint', async () => {
    as(ROBER)
    await expect(sprints.close('s-2')).rejects.toThrow('product owner')
    as(JHONY)
    expect((await sprints.close('s-2')).status).toBe('closed')
    await expect(sprints.close('s-2')).rejects.toThrow('sprint activo')
  })

  it('el cierre deja constancia en la auditoría', async () => {
    await sprints.close('s-2')
    expect(getDb().auditLog.some((a) => a.table === 'sprints' && a.recordId === 's-2')).toBe(true)
  })
})

describe('comentarios en registros', () => {
  it('una objeción queda como comentario en el registro', async () => {
    as(ROBER)
    const entry = getDb().timeEntries.find((e) => e.userId === DIEGO)!
    await comments.add({ entity: 'time_entry', entityId: entry.id, text: '¿Fueron 7 h en la landing?' })
    const list = await comments.list('time_entry', entry.id)
    expect(list).toHaveLength(1)
    expect(list[0].userId).toBe(ROBER)
    await expect(comments.add({ entity: 'time_entry', entityId: entry.id, text: '  ' })).rejects.toThrow()
  })
})
