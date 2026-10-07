import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CommentEntity, Id } from "@vexa/domain/types";
import { services } from "@/services";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

/** Hilo de comentarios de una entidad (tarea, registro de horas o gasto), del más antiguo al más nuevo. */
export function useComments(entity: CommentEntity, entityId: Id) {
  return useQuery({
    queryKey: ["comments", entity, entityId],
    queryFn: () => services.comments.list(entity, entityId),
    enabled: Boolean(entityId),
  });
}

/** Publica un comentario con las menciones ya resueltas; refresca el hilo y los avisos. */
export function useAddComment(entity: CommentEntity, entityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string; mentions: Id[] }) =>
      services.comments.add({ entity, entityId, ...input }),
    onSuccess: () => {
      toast.success("Comentario publicado");
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["comments", entity, entityId] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}
