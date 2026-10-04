import type { DashboardService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { unwrap } from "./errors";
import { mapMemberPoints, mapMonthlySummary } from "./mappers";
import { requireStudioAccess } from "./session";

/**
 * Cumplimiento y puntos los calculan la base de datos (función `monthly_summary` y vista
 * `member_points`, con paridad con `rules.ts`); aquí solo se leen. Se usa la función y no la vista
 * `member_monthly_summary` porque esta solo lista desde el primer mes con actividad.
 */
export function createDashboardService(client: VexaSupabase): DashboardService {
  return {
    async getMonthlySummary(month) {
      await requireStudioAccess(client);
      const rows = unwrap(await client.rpc("monthly_summary", { p_month: month }));
      return rows.map(mapMonthlySummary);
    },
    async getPoints() {
      await requireStudioAccess(client);
      const rows = unwrap(await client.from("member_points").select("*").order("user_id"));
      return rows.map(mapMemberPoints);
    },
  };
}
