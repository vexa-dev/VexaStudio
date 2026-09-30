import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services'

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => services.notifications.list(),
    // La bandeja se refresca sola: los recordatorios programados aparecen a su hora sin recargar.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.notifications.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => services.notifications.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
