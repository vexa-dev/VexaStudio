import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'

export interface PendingActions {
  /** Gastos pendientes en los que la persona todavía no votó. */
  expensesToVote: number
  /** Registros de horas de otros socios que faltan validar, por proyecto con sprint activo. */
  hoursToValidate: { projectId: string; projectName: string; count: number }[]
}

/** Lo que espera a la persona ahora mismo: votos de gastos y horas por validar antes del cierre. */
export function usePendingActions(userId: string | undefined) {
  return useQuery({
    queryKey: ['pending', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PendingActions> => {
      const [expenses, projects] = await Promise.all([services.expenses.list(), services.projects.list()])
      const pending = expenses.filter((e) => e.status === 'pending')
      const voteLists = await Promise.all(pending.map((e) => services.expenses.listVotes(e.id)))
      const expensesToVote = voteLists.filter((votes) => !votes.some((v) => v.userId === userId)).length

      const sprints = await Promise.all(projects.map((p) => services.sprints.getActive(p.id)))
      const reviews = await Promise.all(sprints.map((s) => (s ? services.sprints.getReview(s.id) : null)))
      const hoursToValidate = projects
        .map((project, i) => ({
          projectId: project.id,
          projectName: project.name,
          count: (reviews[i]?.entries ?? []).filter((e) => e.userId !== userId && !e.validated).length,
        }))
        .filter((item) => item.count > 0)
      return { expensesToVote, hoursToValidate }
    },
  })
}
