import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CommentEntity } from '@/domain/types'
import { services } from '@/services'

export function useComments(entity: CommentEntity, entityId: string) {
  return useQuery({
    queryKey: ['comments', entity, entityId],
    queryFn: () => services.comments.list(entity, entityId),
  })
}

export function useAddComment(entity: CommentEntity, entityId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => services.comments.add({ entity, entityId, text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comments', entity, entityId] })
      // Una mención genera un aviso para otra persona; la bandeja propia no cambia, pero se refresca por coherencia.
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'No se pudo enviar el comentario'),
  })
}
