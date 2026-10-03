import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@vexa/domain/types";
import { toast } from "sonner";
import { services } from "@/services";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => services.projects.list(),
  });
}

export function useSaveProject(projectId?: string) {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Project, "id">) =>
      projectId
        ? services.projects.update(projectId, input)
        : services.projects.create(input),
    onSuccess: async () => {
      await Promise.all([
        query.invalidateQueries({ queryKey: ["projects"] }),
        query.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Proyecto guardado");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el proyecto",
      ),
  });
}

export function useProjectLabels(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["project-labels", projectId],
    queryFn: () => services.projects.listLabels(projectId),
    enabled: enabled && Boolean(projectId),
  });
}
export function useSaveProjectLabel(projectId: string) {
  const query = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; name: string; color: string }) =>
      input.id
        ? services.projects.updateLabel(input.id, input)
        : services.projects.createLabel(projectId, input),
    onSuccess: async () => {
      await Promise.all([
        query.invalidateQueries({ queryKey: ["project-labels", projectId] }),
        query.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      toast.success("Etiqueta guardada");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la etiqueta",
      ),
  });
}
