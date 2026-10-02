import { useQuery } from '@tanstack/react-query'
import type { Project, Sprint, TaskStatus } from '@/domain/types'
import { monthRange } from '@/lib/dates'
import { services } from '@/services'

export interface ProjectSummary {
  project: Project
  /** Sprint activo del proyecto, si existe. */
  sprint: Sprint | null
  tasksByStatus: Record<TaskStatus, number>
  taskCount: number
  /** Horas registradas por todo el equipo este mes (Lima) en tareas del proyecto. */
  monthHours: number
}

const emptyCounts = (): Record<TaskStatus, number> => ({ todo: 0, in_progress: 0, review: 0, done: 0 })

/** Proyectos con lo que hace falta para decidir dónde trabajar: sprint, avance de tareas y horas del mes. */
export function useProjectSummaries() {
  return useQuery({
    queryKey: ['projects', 'summaries'],
    queryFn: async (): Promise<ProjectSummary[]> => {
      const { start, end } = monthRange(new Date())
      const [projects, tasks, entries] = await Promise.all([
        services.projects.list(),
        services.tasks.list(),
        services.time.listEntries({ from: start.toISOString(), to: end.toISOString() }),
      ])
      const sprints = await Promise.all(projects.map((p) => services.sprints.getActive(p.id)))
      const projectOfTask = new Map(tasks.map((t) => [t.id, t.projectId]))

      return projects.map((project, i) => {
        const sprint = sprints[i]
        const scoped = tasks.filter((t) => t.projectId === project.id && (!sprint || t.sprintId === sprint.id))
        const tasksByStatus = emptyCounts()
        for (const task of scoped) tasksByStatus[task.status] += 1
        const monthHours = entries
          .filter((e) => !e.voidedAt && (e.taskId ? projectOfTask.get(e.taskId) : e.projectId) === project.id)
          .reduce((sum, e) => sum + e.hours, 0)
        return { project, sprint, tasksByStatus, taskCount: scoped.length, monthHours }
      })
    },
  })
}
