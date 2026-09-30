import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ExpenseVote } from '@/domain/types'
import { services, type NewExpenseInput } from '@/services'

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Ocurrió un error inesperado')

/** Gastos con los votos de los pendientes y los gastos recurrentes, en una sola consulta. */
export function useExpenseBoard() {
  return useQuery({
    queryKey: ['expenses', 'board'],
    queryFn: async () => {
      const [expenses, recurring] = await Promise.all([services.expenses.list(), services.expenses.listRecurring()])
      const pending = expenses.filter((e) => e.status === 'pending')
      const voteLists = await Promise.all(pending.map((e) => services.expenses.listVotes(e.id)))
      const votes = new Map<string, ExpenseVote[]>(pending.map((e, i) => [e.id, voteLists[i]]))
      return { expenses, recurring, votes }
    },
  })
}

/** Un gasto aprobado cambia los puntos: el dashboard y las pendientes de Inicio se recalculan. */
function useRefreshExpenses() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['pending'] }),
    ])
}

export function useCreateExpense() {
  const refresh = useRefreshExpenses()
  return useMutation({
    mutationFn: (input: NewExpenseInput) => services.expenses.create(input),
    onSuccess: async (expense) => {
      await refresh()
      toast.success(
        expense.status === 'approved'
          ? 'Gasto registrado y aprobado'
          : 'Gasto registrado: queda pendiente hasta tener 3 votos a favor',
      )
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useVoteExpense() {
  const refresh = useRefreshExpenses()
  return useMutation({
    mutationFn: ({ id, inFavor }: { id: string; inFavor: boolean }) => services.expenses.vote(id, inFavor),
    onSuccess: async (expense) => {
      await refresh()
      if (expense.status === 'approved') toast.success('Con tu voto el gasto quedó aprobado')
      else if (expense.status === 'rejected') toast('Con tu voto el gasto quedó rechazado')
      else toast.success('Voto registrado')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useVoidExpense() {
  const refresh = useRefreshExpenses()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => services.expenses.void(id, reason),
    onSuccess: async () => {
      await refresh()
      toast.success('Gasto anulado')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}
