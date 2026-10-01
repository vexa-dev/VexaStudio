import { beforeEach, describe, expect, it } from 'vitest'
import { todayLima } from '@/lib/dates'
import { getDb, resetMock, setSessionUserId } from './db'
import { sprints, tasks, time } from './work'

const ROBER = 'u-rober'
const DIEGO = 'u-diego'

beforeEach(() => {
  resetMock()
  setSessionUserId(ROBER)
})

const openEntries = (userId: string) =>
  getDb().timeEntries.filter((e) => e.userId === userId && e.endedAt === null && !e.voidedAt)

describe('temporizador', () => {
  it('iniciar uno detiene el anterior: solo queda uno abierto', async () => {
    const first = await time.start('t-5')
    const second = await time.start('t-3')
    expect(openEntries(ROBER)).toHaveLength(1)
    expect(openEntries(ROBER)[0].id).toBe(second.id)
    const closed = getDb().timeEntries.find((e) => e.id === first.id)
    expect(closed?.endedAt).not.toBeNull()
  })

  it('al iniciar, la tarea pendiente pasa a en progreso', async () => {
    await time.start('t-7') // "Registrar gastos recurrentes", pendiente
    expect(getDb().tasks.find((t) => t.id === 't-7')?.status).toBe('in_progress')
  })

  it('detener sin temporizador abierto devuelve null', async () => {
    expect(await time.stop()).toBeNull()
  })

  it('el temporizador de una persona no detiene el de otra', async () => {
    await time.start('t-5')
    setSessionUserId(DIEGO)
    await time.start('t-4')
    expect(openEntries(ROBER)).toHaveLength(1)
    expect(openEntries(DIEGO)).toHaveLength(1)
  })
})

describe('registro manual', () => {
  it('crea el registro con las horas indicadas y lo deja en la auditoría', async () => {
    const entry = await time.addManual({ taskId: 't-5', date: todayLima(), hours: 1.5 })
    expect(entry).toMatchObject({ userId: ROBER, hours: 1.5, validated: false, paid: false })
    expect(getDb().auditLog.some((a) => a.recordId === entry.id && a.action === 'create')).toBe(true)
  })

  it('rechaza fechas futuras y horas fuera de rango', async () => {
    await expect(time.addManual({ taskId: 't-5', date: '2999-01-01', hours: 1 })).rejects.toThrow('futura')
    await expect(time.addManual({ taskId: 't-5', date: todayLima(), hours: 0 })).rejects.toThrow('entre 0 y 24')
    await expect(time.addManual({ taskId: 't-5', date: todayLima(), hours: 25 })).rejects.toThrow('entre 0 y 24')
  })
})

describe('edición y anulación', () => {
  it('permite editar un registro propio reciente', async () => {
    const updated = await time.update('h-u-rober-0-0', { hours: 2 })
    expect(updated.hours).toBe(2)
  })

  it('no permite editar registros de otra persona', async () => {
    await expect(time.update('h-u-diego-0-0', { hours: 2 })).rejects.toThrow('propios')
  })

  it('no permite editar un registro validado', async () => {
    await expect(time.update('h-u-rober-2-0', { hours: 2 })).rejects.toThrow('ya no se puede editar')
  })

  it('anular exige motivo y deja constancia', async () => {
    await expect(time.void('h-u-rober-0-1', ' ')).rejects.toThrow('motivo')
    const voided = await time.void('h-u-rober-0-1', 'Lo registré dos veces')
    expect(voided.voidedAt).not.toBeNull()
    expect(getDb().auditLog.some((a) => a.recordId === voided.id && a.action === 'void')).toBe(true)
  })

  it('no permite anular un registro validado', async () => {
    await expect(time.void('h-u-rober-2-0', 'Prueba')).rejects.toThrow('validado')
  })
})

describe('tareas y sprints', () => {
  it('crea y mueve una tarea', async () => {
    const task = await tasks.create({
      sprintId: 's-2',
      projectId: 'p-vexa',
      title: '  Probar el kanban  ',
      assigneeId: ROBER,
      estimateHours: 2,
      link: null,
    })
    expect(task).toMatchObject({ title: 'Probar el kanban', status: 'todo' })
    expect((await tasks.move(task.id, 'review')).status).toBe('review')
  })

  it('el primer sprint de un proyecto queda activo y el siguiente planificado', async () => {
    const input = { projectId: 'p-fivuza', startDate: '2026-10-01', endDate: '2026-10-14', goal: 'Lanzar la landing' }
    expect((await sprints.create(input)).status).toBe('active')
    expect((await sprints.create({ ...input, goal: 'Siguiente' })).status).toBe('planned')
  })

  it('rechaza un sprint que termina antes de empezar', async () => {
    await expect(
      sprints.create({ projectId: 'p-fivuza', startDate: '2026-10-14', endDate: '2026-10-01', goal: 'X' }),
    ).rejects.toThrow('anterior')
  })
})
