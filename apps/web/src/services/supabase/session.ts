import type { Id, Profile } from "@vexa/domain/types";
import { canAccessStudio } from "@vexa/domain/access";
import type { VexaSupabase } from "@/lib/supabase";
import { unwrapMaybe } from "./errors";
import { mapProfile } from "./mappers";

/** Id de la persona con sesión, leído de la sesión local (sin ir a la red). */
export async function requireUserId(client: VexaSupabase): Promise<Id> {
  const { data } = await client.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Inicia sesión para continuar");
  return id;
}

/** Perfil activo de la persona con sesión; RLS oculta los perfiles inactivos. */
export async function getCurrentProfile(client: VexaSupabase): Promise<Profile> {
  const id = await requireUserId(client);
  const row = unwrapMaybe(
    await client.from("profiles").select("*").eq("id", id).maybeSingle(),
  );
  if (!row) throw new Error("Inicia sesión para continuar");
  return mapProfile(row);
}

/** Dashboard, gastos y equipo son solo para socios y administradores (como el mock). */
export async function requireStudioAccess(
  client: VexaSupabase,
): Promise<Profile> {
  const profile = await getCurrentProfile(client);
  if (!canAccessStudio(profile.role))
    throw new Error(
      "Solo los socios y administradores tienen acceso a la información del estudio.",
    );
  return profile;
}

/** Marca todas las llamadas de una operación con el mismo `x-request-id` del registro. */
export function tagged<T extends { setHeader(name: string, value: string): T }>(
  builder: T,
  requestId: string,
): T {
  return builder.setHeader("x-request-id", requestId);
}
