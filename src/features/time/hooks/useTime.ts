import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatHours } from "@/lib/format";
import { services, type ManualEntryInput } from "@/services";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

export function useRunningEntry() {
  return useQuery({
    queryKey: ["time", "running"],
    queryFn: () => services.time.getRunning(),
    refetchInterval: 3000,
  });
}

export function useEntries(
  range: { from: string; to: string },
  userId?: string,
) {
  return useQuery({
    queryKey: ["time", "entries", range, userId],
    queryFn: () => services.time.listEntries({ ...range, userId }),
    enabled: userId !== undefined,
  });
}

/** Las horas alimentan el dashboard, los resúmenes de proyecto y (al iniciar) el estado de la tarea. */
function useRefreshTime() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["time"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
}

export function useStartTimer() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: (taskId: string) => services.time.start(taskId),
    onSuccess: () => refresh(),
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function useStopTimer() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: () => services.time.stop(),
    onSuccess: async (entry) => {
      await refresh();
      if (entry)
        toast.success(`Tiempo preparado en Horas: ${formatHours(entry.hours)}`);
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function useAddManualEntry() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: (input: ManualEntryInput) => services.time.addManual(input),
    onSuccess: async (entry) => {
      await refresh();
      toast.success(`Registraste ${formatHours(entry.hours)}`);
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function useUpdateEntry() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof services.time.update>[1];
    }) => services.time.update(id, patch),
    onSuccess: async () => {
      await refresh();
      toast.success("Registro actualizado");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function useVoidEntry() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      services.time.void(id, reason),
    onSuccess: async () => {
      await refresh();
      toast.success("Registro anulado");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function useTimeHistory() {
  return useQuery({
    queryKey: ["time", "history"],
    queryFn: () => services.time.listEntries(),
  });
}
export function useReviewTime() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      if (note === undefined) await services.time.validate([id]);
      else await services.time.requestClarification(id, note);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Revisión guardada");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}
export function useActivityTimer() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: (activity: { description: string; projectId: string | null }) =>
      services.time.start(null, activity),
    onSuccess: () => refresh(),
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function usePauseTimer() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: () => services.time.pause(),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(messageOf(e)),
  });
}
export function useResumeTimer() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: () => services.time.resume(),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(messageOf(e)),
  });
}
export function useHoursDrafts() {
  return useQuery({
    queryKey: ["time", "drafts"],
    queryFn: () => services.time.listDrafts(),
  });
}
export function useSubmitDrafts() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: (input: Parameters<typeof services.time.submitDrafts>[0]) =>
      services.time.submitDrafts(input),
    onSuccess: async () => {
      await refresh();
      toast.success("Horas enviadas a revisi\u00f3n");
    },
    onError: (e) => toast.error(messageOf(e)),
  });
}
