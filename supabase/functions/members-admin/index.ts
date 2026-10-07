// Edge Function `members-admin` (Deno). Acciones: `invite`, `revoke-sessions`, `restore-access`.
// Solo un administrador activo puede llamarla: se verifica el JWT y el perfil con el cliente DE QUIEN
// LLAMA (RLS); solo despues se usa el cliente de servicio (`SUPABASE_SERVICE_ROLE_KEY`, que Supabase
// inyecta y nunca sale de aqui). Los errores al cliente son genericos: nunca incluyen claves ni el
// estado de una cuenta existente.
//
// Secretos opcionales: ALLOWED_ORIGINS (lista separada por comas; la primera es el origen por defecto
// para `redirectTo`). Despliegue: `supabase functions deploy members-admin`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAlreadyRegistered, parseInvite, parseMemberId, pickOrigin } from "./validate.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const BAN_FOREVER = "876000h";
const MAX_BODY = 10_000;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed ?? "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-client, x-client-at",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function reply(origin: string | null, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

const fail = (origin: string | null, status: number, code: string, message: string) =>
  reply(origin, status, { ok: false, code, message });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail(origin, 405, "method_not_allowed", "Método no permitido");

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !service) return fail(origin, 500, "misconfigured", "No se pudo completar la acción");
  if (!authorization) return fail(origin, 401, "unauthorized", "Inicia sesión para continuar");

  // 1) Quien llama: JWT valido y perfil admin activo, leido con SU cliente (RLS).
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return fail(origin, 401, "unauthorized", "Inicia sesión para continuar");
  const { data: me } = await caller
    .from("profiles")
    .select("id, role, active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!me || me.role !== "admin" || !me.active)
    return fail(origin, 403, "forbidden", "Solo un administrador gestiona al equipo");

  // 2) Entrada.
  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail(origin, 413, "invalid", "Solicitud demasiado grande");
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("body");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail(origin, 400, "invalid", "Solicitud no válida");
  }

  // Solo ahora se crea el cliente de servicio.
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  switch (body.action) {
    case "invite": {
      const parsed = parseInvite(body);
      if (!parsed.ok) return fail(origin, 400, "invalid", parsed.message);
      const { email, name, area, weeklyHours, projectIds } = parsed.value;
      const base = pickOrigin(origin, ALLOWED_ORIGINS);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name, area, weekly_hours: weeklyHours },
        redirectTo: base ? `${base}/restablecer` : undefined,
      });
      if (error || !data.user) {
        if (error && isAlreadyRegistered(error))
          return fail(origin, 409, "already_exists", "Ya existe una cuenta con ese correo");
        return fail(origin, 502, "invite_failed", "No se pudo enviar la invitación. Inténtalo de nuevo.");
      }
      // Membresias iniciales con el cliente de quien llama: las mismas politicas (solo admin inserta).
      let projectsAdded = true;
      if (projectIds.length > 0) {
        const { error: insertError } = await caller
          .from("project_members")
          .insert(projectIds.map((project_id) => ({ project_id, user_id: data.user.id })));
        projectsAdded = !insertError;
      }
      return reply(origin, 200, { ok: true, memberId: data.user.id, projectsAdded });
    }
    case "revoke-sessions":
    case "restore-access": {
      const parsed = parseMemberId(body);
      if (!parsed.ok) return fail(origin, 400, "invalid", parsed.message);
      const revoke = body.action === "revoke-sessions";
      // El estado de la persona manda: solo se bloquea a quien ya esta inactivo y solo se libera a quien ya esta activo.
      const { data: target } = await caller
        .from("profiles")
        .select("id, active")
        .eq("id", parsed.value)
        .maybeSingle();
      if (!target || target.id === me.id || target.active === revoke)
        return fail(origin, 409, "invalid_state", "El estado de la persona no permite esta acción");
      const { error } = await admin.auth.admin.updateUserById(target.id, {
        ban_duration: revoke ? BAN_FOREVER : "none",
      });
      if (error) return fail(origin, 502, "auth_failed", "No se pudo actualizar el acceso. Inténtalo de nuevo.");
      return reply(origin, 200, { ok: true });
    }
    default:
      return fail(origin, 400, "invalid", "Acción no válida");
  }
});
