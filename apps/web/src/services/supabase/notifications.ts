import type { NotificationService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { toServiceError, unwrap, unwrapMaybe } from "./errors";
import { mapNotification, mapNotificationPreferences } from "./mappers";
import { requireUserId } from "./session";

const LIST_LIMIT = 50;

/** Sin fila guardada todo está activado (igual que en el trigger de la base). */
const DEFAULT_PREFERENCES = {
  task_assigned: true,
  hours_reminder: true,
  weekly_summary: true,
};

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
    async getPreferences() {
      const userId = await requireUserId(client);
      const row = unwrapMaybe(
        await client
          .from("notification_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      );
      return mapNotificationPreferences(row ?? DEFAULT_PREFERENCES);
    },
    async updatePreferences(patch) {
      // `undefined` = no tocar; el RPC crea la fila si aún no existe.
      const row = unwrap(
        await client.rpc("set_notification_preferences", {
          p_task_assigned: patch.taskAssigned,
          p_hours_reminder: patch.hoursReminder,
          p_weekly_summary: patch.weeklySummary,
        }),
      );
      return mapNotificationPreferences(row);
    },
  };
}
