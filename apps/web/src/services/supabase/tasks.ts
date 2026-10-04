import type { Task } from "@vexa/domain/types";
import type { TaskService } from "@vexa/services";
import { newRequestId, type VexaSupabase } from "@/lib/supabase";
import { unwrap, unwrapMaybe } from "./errors";
import { mapTask, TASK_SELECT, taskPatchToColumns, type TaskRow } from "./mappers";
import { getCurrentProfile, tagged } from "./session";

/**
 * Tareas. Las políticas RLS dejan ver al usuario sus tareas más las de sus proyectos; la pantalla
 * "Mis tareas" del mock mostraba solo las asignadas (y el administrador todas), así que `list`
 * aplica ese mismo recorte cuando no se pide un tablero de proyecto.
 */
export function createTaskService(client: VexaSupabase): TaskService {
  async function fetchTask(id: string): Promise<Task> {
    const row = unwrapMaybe(
      await client
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<TaskRow, { merge: false }>(),
    );
    if (!row) throw new Error("La tarea no existe");
    return mapTask(row);
  }

  async function setLabels(id: string, labels: Task["labels"], requestId: string) {
    unwrap(
      await tagged(
        client.rpc("set_task_labels", {
          p_task: id,
          p_label_ids: [...new Set((labels ?? []).map((l) => l.id))],
        }),
        requestId,
      ),
    );
  }

  return {
    async list(filter = {}) {
      let query = client.from("tasks").select(TASK_SELECT);
      if (filter.projectId) query = query.eq("project_id", filter.projectId);
      if (filter.sprintId) query = query.eq("sprint_id", filter.sprintId);
      if (filter.assigneeId) query = query.eq("assignee_id", filter.assigneeId);
      const [rows, profile] = await Promise.all([
        query
          .order("created_at")
          .order("id")
          .overrideTypes<TaskRow[], { merge: false }>(),
        getCurrentProfile(client),
      ]);
      const tasks = unwrap(rows).map(mapTask);
      const projectBoard = Boolean(filter.projectId);
      return profile.role === "admin" || projectBoard
        ? tasks
        : tasks.filter((task) => task.assigneeId === profile.id);
    },
    async create(input) {
      if (!input.title.trim()) throw new Error("Escribe el título de la tarea");
      if (input.labels?.length && !input.projectId)
        throw new Error("Las etiquetas deben pertenecer al proyecto de la tarea");
      const requestId = newRequestId();
      const inserted = unwrap(
        await tagged(
          client
            .from("tasks")
            .insert({
              sprint_id: input.sprintId,
              project_id: input.projectId,
              title: input.title.trim(),
              description: input.description ?? null,
              status: input.status ?? "todo",
              assignee_id: input.assigneeId,
              estimate_hours: input.estimateHours,
              link: input.link,
            })
            .select("id")
            .single(),
          requestId,
        ),
      );
      if (input.labels?.length) await setLabels(inserted.id, input.labels, requestId);
      return fetchTask(inserted.id);
    },
    async update(id, patch) {
      if (patch.title !== undefined && !patch.title.trim())
        throw new Error("Escribe el título de la tarea");
      const requestId = newRequestId();
      const columns = taskPatchToColumns(patch);
      if (Object.keys(columns).length > 0) {
        const row = unwrapMaybe(
          await tagged(
            client.from("tasks").update(columns).eq("id", id).select("id").maybeSingle(),
            requestId,
          ),
        );
        // RLS no distingue "no existe" de "no es tuya": ambos dejan cero filas.
        if (!row) throw new Error("No tienes permiso para modificar esta tarea o ya no existe");
      }
      if (patch.labels !== undefined) await setLabels(id, patch.labels, requestId);
      return fetchTask(id);
    },
    async move(id, status) {
      const moved = unwrapMaybe(
        await client.rpc("move_task", { p_id: id, p_status: status }),
      );
      // Si RLS deja el UPDATE sin filas (tarea ajena), `move_task` no falla: devuelve un registro
      // vacío. El mock lanza este mismo mensaje.
      if (!moved?.id)
        throw new Error("Solo puedes trabajar en tus tareas asignadas");
      return fetchTask(id);
    },
  };
}
