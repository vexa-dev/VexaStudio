import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Ocurrió un error inesperado')

export function useSprintReview(sprintId: string | undefined) {
  return useQuery({
    queryKey: ['sprints', 'review', sprintId],
    queryFn: () => services.sprints.getReview(sprintId as string),
    enabled: Boolean(sprintId),
  })
}

function useRefreshReview() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sprints'] }),
      queryClient.invalidateQueries({ queryKey: ['time'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['pending'] }),
    ])
}

export function useValidateEntries() {
  const refresh = useRefreshReview()
  return useMutation({
    mutationFn: (ids: string[]) => services.time.validate(ids),
    onSuccess: async (entries) => {
      await refresh()
      toast.success(entries.length === 1 ? 'Registro validado' : `${entries.length} registros validados`)
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useCloseSprint() {
  const refresh = useRefreshReview()
  return useMutation({
    mutationFn: (sprintId: string) => services.sprints.close(sprintId),
    onSuccess: async () => {
      await refresh()
      toast.success('Sprint cerrado')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useObjectEntry() {
  return useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) =>
      services.comments.add({ entity: 'time_entry', entityId: entryId, text }),
    onSuccess: () => toast.success('Objeción enviada como comentario en el registro'),
    onError: (error) => toast.error(messageOf(error)),
  })
}
