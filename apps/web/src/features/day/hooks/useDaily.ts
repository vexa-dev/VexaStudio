import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { services, type NewDailyInput } from "@/services";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

/** Dailies que la persona ya envió (todas las fechas); alimenta el estado "enviado". */
export function useSentDailies(userId: string) {
  return useQuery({
    queryKey: ["daily", "mine", userId],
    queryFn: () => services.daily.list({ userId }),
  });
}

/** Envía el daily de hoy; reenviar el mismo día lo corrige. Refresca también Equipo. */
export function useSubmitDaily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewDailyInput) => services.daily.submit(input),
    onSuccess: () => {
      toast.success("Daily enviado al equipo");
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["daily"] }),
        queryClient.invalidateQueries({ queryKey: ["team"] }),
      ]);
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

/** Texto de "qué hice" armado con las horas trabajadas desde el último daily. */
export function useSuggestDone() {
  return useMutation({
    mutationFn: () => services.daily.suggestDone(),
    onError: (error) => toast.error(messageOf(error)),
  });
}
