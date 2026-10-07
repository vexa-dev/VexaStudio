import {
  buildPartnerReport,
  pendingCloseEntries,
  sprintTaskIds,
  stillPendingAfterClose,
} from "@vexa/domain/sprint-close";
import type { SprintService } from "@vexa/services";
import { newRequestId, type VexaSupabase } from "@/lib/supabase";
import { unwrap, unwrapMaybe } from "./errors";
import { mapSprint, mapTask, mapTimeEntry, TIME_ENTRY_SELECT } from "./mappers";
import { tagged } from "./session";

/**
 * Sprints. El primero de un proyecto nace activo y los siguientes planificados (lo decide un
 * trigger). Cerrar es un solo RPC (`close_sprint`): valida las horas elegidas, guarda el reporte,
 * manda lo pendiente al backlog y cierra, todo o nada. El reporte de un sprint abierto se arma
 * aquí con las mismas reglas puras del dominio; el de uno cerrado es el que guardó el RPC.
 */
export function createSprintService(client: VexaSupabase): SprintService {
  return {
    async listByProject(projectId) {
      const rows = unwrap(
        await client
          .from("sprints")
          .select("*")
          .eq("project_id", projectId)
          .order("start_date")
          .order("created_at"),
      );
      return rows.map(mapSprint);
    },
    async getActive(projectId) {
      const row = unwrapMaybe(
        await client
          .from("sprints")
          .select("*")
          .eq("project_id", projectId)
          .eq("status", "active")
          .maybeSingle(),
      );
      return row ? mapSprint(row) : null;
    },
    async create(input) {
      if (input.endDate < input.startDate)
        throw new Error("El fin del sprint no puede ser anterior al inicio");
      if (!input.goal.trim()) throw new Error("Escribe el objetivo del sprint");
      return mapSprint(
        unwrap(
          await client
            .from("sprints")
            .insert({
              project_id: input.projectId,
              start_date: input.startDate,
              end_date: input.endDate,
              goal: input.goal,
            })
            .select()
            .single(),
        ),
      );
    },
    async close(sprintId, validatedEntryIds) {
      const row = unwrap(
        await tagged(
          client.rpc("close_sprint", {
            p_sprint: sprintId,
            p_entry_ids: [...new Set(validatedEntryIds)],
          }),
          newRequestId(),
        ),
      );
      return mapSprint(row);
    },
    async getCloseReport(sprintId) {
      const row = unwrapMaybe(
        await client.from("sprints").select("*").eq("id", sprintId).maybeSingle(),
      );
      if (!row) throw new Error("El sprint no existe");
      const sprint = mapSprint(row);

      if (sprint.status === "closed") {
        const pendingIds = sprint.closePendingEntryIds ?? [];
        const entries = pendingIds.length
          ? unwrap(
              await client
                .from("time_entries")
                .select(TIME_ENTRY_SELECT)
                .in("id", pendingIds),
            ).map(mapTimeEntry)
          : [];
        return {
          sprint,
          partners: sprint.deliveryReport ?? [],
          pendingEntries: stillPendingAfterClose(entries, pendingIds),
        };
      }

      const tasks = unwrap(
        await client.from("tasks").select("*").eq("sprint_id", sprintId),
      ).map((task) => mapTask(task));
      const taskIds = sprintTaskIds(sprintId, tasks);
      // Registros de esas tareas y los agrupados (sus asignaciones se filtran con la regla del dominio).
      const entries =
        taskIds.size === 0
          ? []
          : unwrap(
              await client
                .from("time_entries")
                .select(TIME_ENTRY_SELECT)
                .eq("draft", false)
                .is("voided_at", null)
                .not("ended_at", "is", null)
                .or(`task_id.in.(${[...taskIds].join(",")}),allocations.not.is.null`),
            ).map(mapTimeEntry);
      return {
        sprint,
        partners: buildPartnerReport(sprintId, tasks, entries),
        pendingEntries: pendingCloseEntries(entries, taskIds),
      };
    },
  };
}
