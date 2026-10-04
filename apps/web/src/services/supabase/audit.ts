import type { AuditService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { unwrap } from "./errors";
import { mapAuditEntry } from "./mappers";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Registro de actividad, solo lectura. Visibilidad por RLS: admin ve todo; socio, sus proyectos y
 * sus acciones; colaborador, solo las suyas. Paginado por `seq` (más recientes primero), igual que
 * el mock: con `cursor` devuelve entradas con `seq` menor.
 */
export function createAuditService(client: VexaSupabase): AuditService {
  return {
    async list(filter = {}, cursor = null, limit = DEFAULT_PAGE_SIZE) {
      const size = Math.min(
        Math.max(Math.trunc(limit) || DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE,
      );
      let query = client.from("audit_log").select("*");
      if (filter.actorId) query = query.eq("actor_id", filter.actorId);
      if (filter.projectId) query = query.eq("project_id", filter.projectId);
      if (filter.entityTable) query = query.eq("entity_table", filter.entityTable);
      if (filter.entityId) query = query.eq("entity_id", filter.entityId);
      if (filter.eventTypes?.length)
        query = query.in("event_type", filter.eventTypes);
      if (filter.from) query = query.gte("occurred_at", filter.from);
      if (filter.to) query = query.lte("occurred_at", filter.to);
      if (cursor !== null) query = query.lt("seq", cursor);
      // Una fila de más indica si hay otra página.
      const rows = unwrap(await query.order("seq", { ascending: false }).limit(size + 1));
      const items = rows.slice(0, size).map(mapAuditEntry);
      return {
        items,
        nextCursor: rows.length > size ? (items.at(-1)?.seq ?? null) : null,
      };
    },
    async timeline(entity) {
      const rows = unwrap(
        await client
          .from("audit_log")
          .select("*")
          .eq("entity_table", entity.table)
          .eq("entity_id", entity.id)
          .order("seq", { ascending: false }),
      );
      return rows.map(mapAuditEntry);
    },
  };
}
