import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatHours } from "@vexa/domain/format";
import {
  services,
  type HoursEvidenceFile,
  type HoursParticipantInput,
  type ManualEntryInput,
} from "@/services";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { EVIDENCE_MAX_BYTES } from "@vexa/domain/hours-evidence";
import { MOCK_EVIDENCE_MAX_BYTES } from "../evidence-files";

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

export function useSetParticipants() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: ({
      entryId,
      participants,
    }: {
      entryId: string;
      participants: HoursParticipantInput[];
    }) => services.time.setParticipants(entryId, participants),
    onSuccess: async () => {
      await refresh();
      toast.success("Personas etiquetadas actualizadas");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

/** Reads a picked file as a data URL, the format `addEvidence` expects. */
export function readFileAsEvidence(file: File): Promise<HoursEvidenceFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve({
            name: file.name,
            type: file.type || "application/octet-stream",
            data: reader.result,
          })
        : reject(new Error("No se pudo leer el archivo."));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

export function useAddEvidence() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: async ({
      entryId,
      file,
    }: {
      entryId: string;
      file: File;
      /** Skips the per-file success toast (batch uploads show their own). */
      silent?: boolean;
    }) =>
      services.time.addEvidence(entryId, await readFileAsEvidence(file)),
    onSuccess: async (_evidence, { file, silent }) => {
      await refresh();
      if (!silent) toast.success(`Adjuntaste ${file.name}`);
    },
    onError: (error, { file }) =>
      toast.error(`${file.name}: ${messageOf(error)}`),
  });
}

export function useRemoveEvidence() {
  const refresh = useRefreshTime();
  return useMutation({
    mutationFn: (evidenceId: string) => services.time.removeEvidence(evidenceId),
    onSuccess: async () => {
      await refresh();
      toast.success("Archivo quitado");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

/**
 * Opens an evidence file in a new tab. The tab is opened synchronously (so popup blockers allow it) and
 * pointed at the temporary URL afterwards; data URLs of the mock become blob URLs because browsers
 * refuse to navigate to them.
 */
export function useOpenEvidence() {
  return useMutation({
    mutationFn: async (evidenceId: string) => {
      const tab = window.open("", "_blank");
      if (tab) tab.opener = null;
      try {
        let url = await services.time.getEvidenceUrl(evidenceId);
        if (url.startsWith("data:"))
          url = URL.createObjectURL(await (await fetch(url)).blob());
        if (tab) tab.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        tab?.close();
        throw error;
      }
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

/** Best-effort sweep of expired evidence, once per time the Hours screen opens. */
export function usePurgeExpiredEvidence() {
  const queryClient = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    services.time
      .purgeExpiredEvidence()
      .then((removed) => {
        if (removed > 0)
          return queryClient.invalidateQueries({ queryKey: ["time"] });
      })
      .catch(() => {
        /* Best effort: a failed sweep never blocks the screen. */
      });
  }, [queryClient]);
}

/** Per-file cap of the active data source (10 MiB in Supabase, 3 MiB in the mock). */
export const evidenceMaxBytes = () =>
  isSupabaseSource() ? EVIDENCE_MAX_BYTES : MOCK_EVIDENCE_MAX_BYTES;
