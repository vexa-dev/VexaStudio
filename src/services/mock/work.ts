import { canEditEntry, hoursBetween } from '@/domain/rules'
import type { AuditAction, Id, Profile, Sprint, Task, TimeEntry } from '@/domain/types'
import { todayLima } from '@/lib/dates'
import type { SprintService, TaskService, TimeService } from '../types'
import { getDb, getSessionUserId, save } from './db'
import { delay, pending } from './utils'

/**
 * Sprints, tareas y horas. Los permisos se aplican aquí igual que lo hará RLS en la etapa 2:
 * cada persona crea y edita solo sus propios registros de horas, y nadie borra (se anula con motivo).
 */

const HOUR_MS = 60 * 60 * 1000

function currentUser(): Profile {
  const id = getSessionUserId()
  const user = getDb().profiles.find((p) => p.id === id && p.active)
  if (!user) throw new Error('Inicia sesión para continuar')
  return user
}

/** Crear tareas y sprints es de admin y socios; los colaboradores solo registran sus horas. */
function currentPartner(): Profile {
  const user = currentUser()
  if (user.role === 'collaborator') throw new Error('Tu rol no permite esta acción')
  return user
}

function newId(prefix: string): Id {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function audit(table: string, recordId: Id, action: AuditAction, before: unknown, after: unknown, userId: Id) {
  getDb().auditLog.push({
    id: newId('au'),
    table,
    recordId,
    action,
    before: before === null ? null : structuredClone(before),
    after: after === null ? null : structuredClone(after),
    userId,
    createdAt: new Date().toISOString(),
  })
}

function findTask(id: Id): Task {
  const task = getDb().tasks.find((t) => t.id === id)
  if (!task) throw new Error('La tarea no existe')
  return task
}

function assertHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('Las horas deben estar entre 0 y 24')
}

/** Cierra un registro abierto: fija el fin y calcula las horas. */
function closeEntry(entry: TimeEntry, now: Date, userId: Id) {
  const before = { ...entry }
  entry.endedAt = now.toISOString()
  entry.hours = hoursBetween(entry.startedAt, entry.endedAt)
  audit('time_entries', entry.id, 'update', before, entry, userId)
}

function ownEntry(id: Id, userId: Id): TimeEntry {
  const entry = getDb().timeEntries.find((e) => e.id === id)
  if (!entry) throw new Error('El registro no existe')
  if (entry.userId !== userId) throw new Error('Solo puedes modificar tus propios registros')
  return entry
}

export const sprints: SprintService = {
  async listByProject(projectId) {
    return delay(getDb().sprints.filter((s) => s.projectId === projectId))
  },
  async getActive(projectId) {
    return delay(getDb().sprints.find((s) => s.projectId === projectId && s.status === 'active') ?? null)
  },
  async create(input) {
    const user = currentPartner()
    const db = getDb()
    if (!db.projects.some((p) => p.id === input.projectId)) throw new Error('El proyecto no existe')
    if (input.endDate < input.startDate) throw new Error('El fin del sprint no puede ser anterior al inicio')
    if (!input.goal.trim()) throw new Error('Escribe el objetivo del sprint')
    const hasActive = db.sprints.some((s) => s.projectId === input.projectId && s.status === 'active')
    const sprint: Sprint = { ...input, goal: input.goal.trim(), id: newId('s'), status: hasActive ? 'planned' : 'active' }
    db.sprints.push(sprint)
    audit('sprints', sprint.id, 'create', null, sprint, user.id)
    save()
    return delay(sprint)
  },
  close: pending('SprintService.close'),
}

export const tasks: TaskService = {
  async list(filter = {}) {
    return delay(
      getDb().tasks.filter(
        (t) =>
          (!filter.projectId || t.projectId === filter.projectId) &&
          (!filter.sprintId || t.sprintId === filter.sprintId) &&
          (!filter.assigneeId || t.assigneeId === filter.assigneeId),
      ),
    )
  },
  async create(input) {
    const user = currentPartner()
    const db = getDb()
    if (!db.projects.some((p) => p.id === input.projectId)) throw new Error('El proyecto no existe')
    if (!input.title.trim()) throw new Error('Escribe el título de la tarea')
    if (input.assigneeId && !db.profiles.some((p) => p.id === input.assigneeId && p.active)) {
      throw new Error('El responsable no existe')
    }
    const task: Task = { ...input, title: input.title.trim(), id: newId('t'), status: input.status ?? 'todo' }
    db.tasks.push(task)
    audit('tasks', task.id, 'create', null, task, user.id)
    save()
    return delay(task)
  },
  async update(id, patch) {
    const user = currentPartner()
    const task = findTask(id)
    if (patch.title !== undefined && !patch.title.trim()) throw new Error('Escribe el título de la tarea')
    const before = { ...task }
    Object.assign(task, patch, patch.title !== undefined ? { title: patch.title.trim() } : {})
    audit('tasks', task.id, 'update', before, task, user.id)
    save()
    return delay(task)
  },
  async move(id, status) {
    const user = currentPartner()
    const task = findTask(id)
    if (task.status === status) return delay(task)
    const before = { ...task }
    task.status = status
    audit('tasks', task.id, 'update', before, task, user.id)
    save()
    return delay(task)
  },
}

export const time: TimeService = {
  async listEntries(filter = {}) {
    const from = filter.from ? new Date(filter.from).getTime() : -Infinity
    const to = filter.to ? new Date(filter.to).getTime() : Infinity
    return delay(
      getDb().timeEntries.filter((e) => {
        const started = new Date(e.startedAt).getTime()
        return (
          (!filter.userId || e.userId === filter.userId) &&
          (!filter.taskId || e.taskId === filter.taskId) &&
          started >= from &&
          started <= to
        )
      }),
    )
  },
  async getRunning() {
    const userId = getSessionUserId()
    return delay(getDb().timeEntries.find((e) => e.userId === userId && e.endedAt === null && !e.voidedAt) ?? null)
  },
  async start(taskId) {
    const user = currentUser()
    const db = getDb()
    const task = findTask(taskId)
    const now = new Date()
    // Un solo temporizador abierto por persona: iniciar uno detiene el anterior.
    for (const open of db.timeEntries.filter((e) => e.userId === user.id && e.endedAt === null && !e.voidedAt)) {
      closeEntry(open, now, user.id)
    }
    const entry: TimeEntry = {
      id: newId('h'),
      userId: user.id,
      taskId,
      startedAt: now.toISOString(),
      endedAt: null,
      hours: 0,
      paid: false,
      validated: false,
      validatedAt: null,
      createdAt: now.toISOString(),
      voidedAt: null,
      voidReason: null,
    }
    db.timeEntries.push(entry)
    audit('time_entries', entry.id, 'create', null, entry, user.id)
    // Al iniciar el temporizador, la tarea pasa a "En progreso".
    if (task.status === 'todo') {
      const before = { ...task }
      task.status = 'in_progress'
      audit('tasks', task.id, 'update', before, task, user.id)
    }
    save()
    return delay(entry)
  },
  async stop() {
    const user = currentUser()
    const open = getDb().timeEntries.find((e) => e.userId === user.id && e.endedAt === null && !e.voidedAt)
    if (!open) return delay(null)
    closeEntry(open, new Date(), user.id)
    save()
    return delay(open)
  },
  async addManual({ taskId, date, hours }) {
    const user = currentUser()
    findTask(taskId)
    assertHours(hours)
    if (date > todayLima()) throw new Error('No puedes registrar horas en una fecha futura')
    // Lima no tiene horario de verano (UTC-5): el mediodía de ese día es una hora segura.
    const startedAt = new Date(`${date}T12:00:00-05:00`).toISOString()
    const now = new Date().toISOString()
    const entry: TimeEntry = {
      id: newId('h'),
      userId: user.id,
      taskId,
      startedAt,
      endedAt: new Date(new Date(startedAt).getTime() + hours * HOUR_MS).toISOString(),
      hours,
      paid: false,
      validated: false,
      validatedAt: null,
      createdAt: now,
      voidedAt: null,
      voidReason: null,
    }
    getDb().timeEntries.push(entry)
    audit('time_entries', entry.id, 'create', null, entry, user.id)
    save()
    return delay(entry)
  },
  async update(id, patch) {
    const user = currentUser()
    const entry = ownEntry(id, user.id)
    if (entry.endedAt === null) throw new Error('Detén el temporizador antes de editar el registro')
    if (!canEditEntry(entry, new Date(), getDb().settings)) {
      throw new Error('Este registro ya no se puede editar: pasaron los días permitidos o fue validado')
    }
    if (patch.taskId) findTask(patch.taskId)
    if (patch.hours !== undefined) assertHours(patch.hours)
    const before = { ...entry }
    const startedAt = patch.startedAt ?? entry.startedAt
    const hours = patch.hours ?? entry.hours
    Object.assign(entry, {
      taskId: patch.taskId ?? entry.taskId,
      startedAt,
      hours,
      endedAt: new Date(new Date(startedAt).getTime() + hours * HOUR_MS).toISOString(),
    })
    audit('time_entries', entry.id, 'update', before, entry, user.id)
    save()
    return delay(entry)
  },
  async void(id, reason) {
    const user = currentUser()
    const entry = ownEntry(id, user.id)
    if (entry.voidedAt) throw new Error('El registro ya está anulado')
    if (entry.validated) throw new Error('No se puede anular un registro validado')
    if (reason.trim().length < 3) throw new Error('Escribe el motivo de la anulación')
    const before = { ...entry }
    entry.voidedAt = new Date().toISOString()
    entry.voidReason = reason.trim()
    audit('time_entries', entry.id, 'void', before, entry, user.id)
    save()
    return delay(entry)
  },
  validate: pending('TimeService.validate'),
}
