import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Id } from "@vexa/domain/types";
import { services } from "@/services";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

/** Anuncios para admin y socios (fijados primero). Un colaborador no los consulta. */
export function useAnnouncements(enabled: boolean) {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: () => services.announcements.list(),
    enabled,
  });
}

/** Publicar o fijar/desfijar (solo admin) refresca la lista. */
export function useAnnouncementActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["announcements"] });
  const create = useMutation({
    mutationFn: (input: { text: string; pinned: boolean }) =>
      services.announcements.create(input.text, { pinned: input.pinned }),
    onSuccess: () => {
      toast.success("Anuncio publicado");
      return refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const setPinned = useMutation({
    mutationFn: (input: { id: Id; pinned: boolean }) =>
      services.announcements.setPinned(input.id, input.pinned),
    onSuccess: (_data, input) => {
      toast.success(input.pinned ? "Anuncio fijado" : "Anuncio desfijado");
      return refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return { create, setPinned };
}
