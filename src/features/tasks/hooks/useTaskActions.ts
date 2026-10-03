import { toast } from "sonner";
import type { Task, TaskStatus } from "@/domain/types";
import { useMoveTask } from "./useTasks";

/**
 * Acciones compartidas por las tarjetas del tablero y de "Mis tareas". Al pasar una tarea a "Hecho"
 * sin enlace, ofrece enlazar el PR o el entregable (flujo "Trabajar una tarea" del PRD).
 */
export function useTaskActions(onEdit: (task: Task) => void) {
  const move = useMoveTask();
  return {
    move(task: Task, status: TaskStatus) {
      if (task.status === status) return;
      move.mutate(
        { id: task.id, status },
        {
          onSuccess: () => {
            if (status === "done" && !task.link) {
              toast.success("Tarea terminada", {
                description: "¿Quieres enlazar el PR o el entregable?",
                action: { label: "Enlazar", onClick: () => onEdit(task) },
              });
            }
          },
        },
      );
    },
  };
}
