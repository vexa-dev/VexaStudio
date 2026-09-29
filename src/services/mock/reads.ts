import type { SprintService, TaskService, TimeService } from '../types'
import { getDb, getSessionUserId } from './db'
import { delay, pending } from './utils'

/**
 * Lecturas de sprints, tareas y horas. Las escrituras (crear, mover, iniciar el temporizador…)
 * llegan en F2; hasta entonces fallan con un mensaje claro.
 */

export const sprints: SprintService = {
  async listByProject(projectId) {
    return delay(getDb().sprints.filter((s) => s.projectId === projectId))
  },
  async getActive(projectId) {
    return delay(getDb().sprints.find((s) => s.projectId === projectId && s.status === 'active') ?? null)
  },
  create: pending('SprintService.create'),
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
  create: pending('TaskService.create'),
  update: pending('TaskService.update'),
  move: pending('TaskService.move'),
}

export const time: TimeService = {
  async listEntries(filter = {}) {
    const from = filter.from ? new Date(filter.from).getTime() : -Infinity
    const to = filter.to ? new Date(filter.to).getTime() : Infinity
    return delay(
      getDb().timeEntries.filter((e) => {
        const started = new Date(e.startedAt).getTime()
        return (
          !e.voidedAt &&
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
  start: pending('TimeService.start'),
  stop: pending('TimeService.stop'),
  addManual: pending('TimeService.addManual'),
  update: pending('TimeService.update'),
  void: pending('TimeService.void'),
  validate: pending('TimeService.validate'),
}
