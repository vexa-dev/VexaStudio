import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { services } from "@/services";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

/** Sprints de un proyecto (para mostrar el último cerrado cuando no hay uno activo). */
export function useProjectSprints(projectId: string) {
  return useQuery({
    queryKey: ["sprints", "project", projectId],
    queryFn: () => services.sprints.listByProject(projectId),
    enabled: Boolean(projectId),
  });
}

/** Entregado vs comprometido y horas pendientes; en un sprint cerrado, el reporte guardado. */
export function useSprintCloseReport(sprintId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["sprints", "close-report", sprintId],
    queryFn: () => {
      const load = services.sprints.getCloseReport;
      if (!load) throw new Error("El reporte de cierre no está disponible.");
      return load.call(services.sprints, sprintId ?? "");
    },
    enabled: enabled && Boolean(sprintId),
  });
}

/** Cerrar el sprint cambia tableros, horas, puntos del tablero de resumen y proyectos. */
export function useCloseSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sprintId,
      entryIds,
    }: {
      sprintId: string;
      entryIds: string[];
    }) => services.sprints.close(sprintId, entryIds),
    onSuccess: async (_sprint, { entryIds }) => {
      await Promise.all(
        ["time", "dashboard", "tasks", "sprints", "projects", "audit"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast.success(
        entryIds.length
          ? `Sprint cerrado. ${entryIds.length} registro${entryIds.length === 1 ? "" : "s"} de horas validado${entryIds.length === 1 ? "" : "s"}.`
          : "Sprint cerrado.",
      );
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}
