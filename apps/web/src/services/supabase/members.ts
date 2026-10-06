import type { MemberService, SettingsService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { unwrap, unwrapMaybe } from "./errors";
import { mapSettings } from "./mappers";
import {
  createSignedUrlResolver,
  withSignedMedia,
  type SignedUrlResolver,
} from "./profile-media";

/** Equipo: cualquier usuario activo lo ve (RLS); solo un administrador lo modifica. */
export function createMemberService(
  client: VexaSupabase,
  resolver: SignedUrlResolver = createSignedUrlResolver(client),
): MemberService {
  return {
    async list() {
      const rows = unwrap(
        await client
          .from("profiles")
          .select("*")
          .order("created_at")
          .order("id"),
      );
      return withSignedMedia(resolver, rows);
    },
    async get(id) {
      const row = unwrapMaybe(
        await client.from("profiles").select("*").eq("id", id).maybeSingle(),
      );
      return row ? ((await withSignedMedia(resolver, [row]))[0] ?? null) : null;
    },
  };
}

/** Parámetros del acuerdo de socios: una sola fila. */
export function createSettingsService(client: VexaSupabase): SettingsService {
  return {
    async get() {
      return mapSettings(unwrap(await client.from("settings").select("*").single()));
    },
  };
}
