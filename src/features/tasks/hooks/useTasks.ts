import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskStatus } from "@/domain/types";
import { services, type NewTaskInput, type TaskFilter } from "@/services";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

export function useTasks(
  filter: TaskFilter = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["tasks", filter],
    queryFn: () => services.tasks.list(filter),
    enabled: options.enabled ?? true,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => services.projects.get(projectId),
  });
}

export function useActiveSprint(projectId: string) {
  return useQuery({
    queryKey: ["sprints", "active", projectId],
    queryFn: () => services.sprints.getActive(projectId),
  });
}

/** Cambios de tareas y sprints afectan tableros, resúmenes de proyecto y tareas propias. */
function useRefreshWork() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["time"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["sprints"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
}

export function useCreateTask() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: (input: NewTaskInput) => services.tasks.create(input),
    onSuccess: async () => {
      await refresh();
      toast.success("Tarea creada");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function useUpdateTask() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof services.tasks.update>[1];
    }) => services.tasks.update(id, patch),
    onSuccess: async () => {
      await refresh();
      toast.success("Tarea actualizada");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}

export function useMoveTask() {
  const queryClient = useQueryClient();
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      services.tasks.move(id, status),
    // Actualización optimista: la tarjeta cambia de columna al soltar, sin esperar al servicio.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const snapshot = queryClient.getQueriesData<
        { id: string; status: TaskStatus }[]
      >({ queryKey: ["tasks"] });
      queryClient.setQueriesData<{ id: string; status: TaskStatus }[]>(
        { queryKey: ["tasks"] },
        (tasks) => tasks?.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
      toast.error(messageOf(error));
    },
    onSettled: () => refresh(),
  });
}

export function useCreateSprint() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: (input: Parameters<typeof services.sprints.create>[0]) =>
      services.sprints.create(input),
    onSuccess: async () => {
      await refresh();
      toast.success("Sprint creado");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
}
