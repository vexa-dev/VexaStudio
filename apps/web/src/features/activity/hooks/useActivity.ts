import { useEffect } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { services, type AuditFilter } from "@/services";

export const ACTIVITY_PAGE_SIZE = 30;

/** Claves de TanStack Query del registro de actividad. */
export const activityKeys = {
  all: ["activity"] as const,
  feed: (filter: AuditFilter) => ["activity", "feed", filter] as const,
  timeline: (table: string, id: string) =>
    ["activity", "timeline", table, id] as const,
};

/**
 * Casi toda mutación de los servicios deja una entrada en el registro. En vez de repetir la
 * invalidación en cada hook de escritura, se refresca la actividad cuando cualquier mutación termina bien.
 */
function useRefreshOnMutations() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "success")
          void queryClient.invalidateQueries({ queryKey: activityKeys.all });
      }),
    [queryClient],
  );
}

/** Registro de actividad, más reciente primero, en páginas por cursor (`seq`). */
export function useActivityFeed(filter: AuditFilter = {}) {
  useRefreshOnMutations();
  return useInfiniteQuery({
    queryKey: activityKeys.feed(filter),
    queryFn: ({ pageParam }) =>
      services.audit.list(filter, pageParam, ACTIVITY_PAGE_SIZE),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Historial de un registro (tarea, horas, proyecto...). */
export function useEntityTimeline(
  table: Parameters<typeof services.audit.timeline>[0]["table"],
  id: string | undefined,
) {
  useRefreshOnMutations();
  return useQuery({
    queryKey: activityKeys.timeline(table, id ?? ""),
    queryFn: () => services.audit.timeline({ table, id: id ?? "" }),
    enabled: Boolean(id),
  });
}
