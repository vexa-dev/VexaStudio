import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Notification } from "@vexa/domain/types";
import { services } from "@/services";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { subscribeToNotifications } from "@/services/supabase/realtime";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string) => ["notifications", userId] as const,
};

/** Marca como leídos los avisos indicados (o todos) en una copia de la lista. */
export function withRead(
  items: Notification[],
  ids?: ReadonlySet<string>,
): Notification[] {
  return items.map((item) =>
    !item.read && (!ids || ids.has(item.id)) ? { ...item, read: true } : item,
  );
}

/**
 * Avisos de la persona con Supabase: lista, marcado (optimista, con retroceso si falla) y recarga
 * cuando llega un aviso nuevo por Realtime. Sin Supabase o sin `userId` queda inactivo; el menú usa
 * entonces sus ejemplos locales.
 */
export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();
  const enabled = isSupabaseSource() && Boolean(userId);
  const key = notificationKeys.list(userId ?? "");

  const query = useQuery({
    queryKey: key,
    queryFn: () => services.notifications.list(),
    enabled,
  });

  useEffect(() => {
    if (!enabled || !userId) return;
    return subscribeToNotifications(userId, () => {
      void queryClient.invalidateQueries({
        queryKey: notificationKeys.list(userId),
      });
    });
  }, [enabled, userId, queryClient]);

  // Actualiza la lista al instante y guarda la anterior por si el servidor rechaza el cambio.
  const applyRead = async (ids?: ReadonlySet<string>) => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<Notification[]>(key);
    if (previous) queryClient.setQueryData(key, withRead(previous, ids));
    return { previous };
  };
  const rollback = (
    error: Error,
    _variables: unknown,
    context: { previous?: Notification[] } | undefined,
  ) => {
    if (context?.previous) queryClient.setQueryData(key, context.previous);
    toast.error(error.message);
  };
  const settle = () => queryClient.invalidateQueries({ queryKey: key });

  const markRead = useMutation({
    mutationFn: (id: string) => services.notifications.markRead(id),
    onMutate: (id) => applyRead(new Set([id])),
    onError: rollback,
    onSettled: settle,
  });

  const markAllRead = useMutation({
    mutationFn: () => services.notifications.markAllRead(),
    onMutate: () => applyRead(),
    onError: rollback,
    onSettled: settle,
  });

  return {
    items: query.data ?? [],
    loaded: query.isSuccess,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}
