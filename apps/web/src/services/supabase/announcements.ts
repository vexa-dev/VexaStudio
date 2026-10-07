import { validateAnnouncementText } from "@vexa/domain/comments";
import type { AnnouncementService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import type { Tables } from "./database.types";
import { unwrap } from "./errors";
import { mapAnnouncement } from "./mappers";
import { getCurrentProfile } from "./session";

/**
 * Anuncios sobre `announcements`. Los leen admin y socios (RLS: un colaborador recibe una lista vacía);
 * solo admin publica y fija o desfija. Nadie borra.
 */
export function createAnnouncementService(client: VexaSupabase): AnnouncementService {
  async function requireAdmin() {
    const profile = await getCurrentProfile(client);
    if (profile.role !== "admin") throw new Error("Solo un administrador publica anuncios");
  }
  return {
    async list() {
      await getCurrentProfile(client);
      const rows = unwrap(
        await client
          .from("announcements")
          .select("*")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id"),
      );
      return rows.map(mapAnnouncement);
    },
    async create(text, options = {}) {
      const message = validateAnnouncementText(text);
      if (message) throw new Error(message);
      await requireAdmin();
      const row = unwrap(
        await client
          .from("announcements")
          .insert({ text: text.trim(), pinned: options.pinned ?? false })
          .select("*")
          .single()
          .overrideTypes<Tables<"announcements">, { merge: false }>(),
      );
      return mapAnnouncement(row);
    },
    async setPinned(id, pinned) {
      await requireAdmin();
      const row = unwrap(
        await client
          .from("announcements")
          .update({ pinned })
          .eq("id", id)
          .select("*")
          .single()
          .overrideTypes<Tables<"announcements">, { merge: false }>(),
      );
      return mapAnnouncement(row);
    },
  };
}
