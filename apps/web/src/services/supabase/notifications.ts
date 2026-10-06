import type { NotificationService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { toServiceError, unwrap } from "./errors";
import { mapNotification } from "./mappers";

const LIST_LIMIT = 50;

/**
 * Avisos de la persona con sesión. Solo lee y marca: los crean triggers de la base. El RLS ya limita
 * las filas a las propias; los RPC marcan únicamente `read_at`.
 */
export function createNotificationService(client: VexaSupabase): NotificationService {
  return {
    async list() {
      const rows = unwrap(
        await client
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(LIST_LIMIT),
      );
      return rows.map(mapNotification);
    },
    async markRead(id) {
      const { error } = await client.rpc("mark_notification_read", { p_id: id });
      if (error) throw toServiceError(error);
    },
    async markAllRead() {
      const { error } = await client.rpc("mark_all_notifications_read");
      if (error) throw toServiceError(error);
    },
  };
}
