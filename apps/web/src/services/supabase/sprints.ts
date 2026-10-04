import type { SprintService } from "@vexa/services";
import { pending, unwrap, unwrapMaybe } from "./errors";
import { mapSprint } from "./mappers";
import type { VexaSupabase } from "@/lib/supabase";

/**
 * Sprints. El primero de un proyecto nace activo y los siguientes planificados (lo decide un
 * trigger). Cerrar el sprint sigue pendiente, igual que en el mock.
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
    close: pending("SprintService.close"),
  };
}
