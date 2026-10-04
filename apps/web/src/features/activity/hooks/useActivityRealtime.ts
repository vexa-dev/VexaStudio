import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToAuditInserts } from "@/services/supabase/realtime";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { activityKeys } from "./useActivity";

/** Agrupa ráfagas de eventos (una operación escribe varias entradas) en una sola recarga. */
const REFRESH_DELAY_MS = 300;

/**
 * Con Supabase, refresca el registro cuando alguien (otra persona u otra pestaña) agrega actividad.
 * Con el mock no hace nada: sus escrituras ya invalidan la actividad en este mismo navegador.
 */
export function useActivityRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isSupabaseSource()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToAuditInserts(() => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: activityKeys.all }),
        REFRESH_DELAY_MS,
      );
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient]);
}
