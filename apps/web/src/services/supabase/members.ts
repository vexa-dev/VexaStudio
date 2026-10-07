import { MEMBER_ADMIN_MESSAGES, validateInvite } from "@vexa/domain/member-admin";
import type { MemberService, SettingsService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { toServiceError, unwrap, unwrapMaybe } from "./errors";
import { mapSettings } from "./mappers";
import {
  createSignedUrlResolver,
  withSignedMedia,
  type SignedUrlResolver,
} from "./profile-media";

const FUNCTION = "members-admin";
const GENERIC = "No se pudo completar la acción. Inténtalo de nuevo.";

/** Mensaje que la Edge Function dejó en el cuerpo de una respuesta no 2xx (siempre genérico, sin claves). */
async function functionFailure(error: unknown): Promise<Error> {
  const { name, context } = (typeof error === "object" && error !== null ? error : {}) as {
    name?: string;
    context?: unknown;
  };
  if (name === "FunctionsFetchError") return new Error("No se pudo conectar con el servidor. Revisa tu conexión.", { cause: error });
  if (typeof Response !== "undefined" && context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { message?: unknown };
      if (typeof body.message === "string" && body.message) return new Error(body.message, { cause: error });
    } catch {
      // Cuerpo no JSON: mensaje genérico.
    }
  }
  return name === "FunctionsHttpError" || name === "FunctionsRelayError"
    ? new Error(GENERIC, { cause: error })
    : toServiceError(error);
}

/** Llama a la Edge Function `members-admin` con la sesión de quien administra. */
async function callMembersAdmin<T extends { ok: true }>(
  client: VexaSupabase,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke(FUNCTION, { body });
  if (error) throw await functionFailure(error);
  const result = data as ({ ok: true } & T) | { ok: false; message?: string } | null;
  if (!result || !result.ok) throw new Error((result && "message" in result && result.message) || GENERIC);
  return result as T;
}

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
    async invite(input) {
      const checked = validateInvite(input);
      if (!checked.ok) throw new Error(checked.message);
      const { email, name, role, area, weeklyHours, projectIds } = checked.value;
      const result = await callMembersAdmin<{ ok: true; memberId: string; projectsAdded: boolean }>(client, {
        action: "invite",
        email,
        name,
        role,
        area,
        weeklyHours,
        projectIds,
      });
      const row = unwrapMaybe(
        await client.from("profiles").select("*").eq("id", result.memberId).maybeSingle(),
      );
      if (!result.projectsAdded)
        throw new Error("Invitación enviada, pero no se pudieron asignar los proyectos. Agrégalos desde Proyectos.");
      if (!row) throw new Error("Invitación enviada. El perfil aparecerá cuando la persona acepte.");
      const [profile] = await withSignedMedia(resolver, [row]);
      return { ...profile, pendingInvite: true };
    },
    async setRole(memberId, role, note) {
      const row = unwrap(
        await client.rpc("set_member_role", { p_member: memberId, p_role: role, p_note: note?.trim() || undefined }),
      );
      return (await withSignedMedia(resolver, [row]))[0];
    },
    async setActive(memberId, active, reason) {
      if (!active && !reason?.trim()) throw new Error(MEMBER_ADMIN_MESSAGES.reasonRequired);
      const row = unwrap(
        await client.rpc("set_member_active", {
          p_member: memberId,
          p_active: active,
          p_reason: reason?.trim() || undefined,
        }),
      );
      // La base ya bloquea a la persona inactiva (RLS); cerrar/restaurar sus sesiones es el segundo paso.
      try {
        await callMembersAdmin(client, { action: active ? "restore-access" : "revoke-sessions", memberId });
      } catch (error) {
        throw new Error(
          active
            ? "La persona quedó activa, pero no se pudo restaurar su acceso. Vuelve a intentarlo."
            : "La persona quedó desactivada, pero no se pudieron cerrar sus sesiones. Vuelve a intentarlo.",
          { cause: error },
        );
      }
      return (await withSignedMedia(resolver, [row]))[0];
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
