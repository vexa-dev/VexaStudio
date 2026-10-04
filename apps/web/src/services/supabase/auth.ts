import type { Profile } from "@vexa/domain/types";
import type { AuthService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { toServiceError, unwrapMaybe } from "./errors";
import { mapProfile } from "./mappers";

/**
 * Acceso por invitación: la cuenta la crea un administrador y la persona entra con correo y
 * contraseña. No hay registro público. El contrato `AuthService` nació para el login simulado
 * (elegir un perfil); aquí se amplía con el acceso por credenciales, que la interfaz detecta con
 * `"signInWithPassword" in services.auth`.
 */
export interface CredentialsAuthService extends AuthService {
  signInWithPassword(email: string, password: string): Promise<Profile>;
  /** Avisa cuando la sesión cambia fuera de esta pestaña (cierre en otra pestaña, token vencido). */
  onSessionChange(listener: (profile: Profile | null) => void): () => void;
}

interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/** Mensajes de Supabase Auth en español para la persona usuaria. */
export function toAuthError(error: AuthErrorLike): Error {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message))
    return new Error("Correo o contraseña incorrectos", { cause: error });
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message))
    return new Error("Tu cuenta aún no está confirmada. Usa el enlace de tu invitación.", {
      cause: error,
    });
  if (code === "over_request_rate_limit" || error.status === 429)
    return new Error("Demasiados intentos. Espera un momento e inténtalo de nuevo.", {
      cause: error,
    });
  return toServiceError(error);
}

export function createAuthService(client: VexaSupabase): CredentialsAuthService {
  /** Perfil activo; RLS no devuelve los inactivos. */
  async function fetchProfile(id: string): Promise<Profile | null> {
    const row = unwrapMaybe(
      await client.from("profiles").select("*").eq("id", id).maybeSingle(),
    );
    return row ? mapProfile(row) : null;
  }

  return {
    async listLoginProfiles() {
      // Sin sesión no se puede leer el equipo (RLS): el acceso es por correo y contraseña.
      return [];
    },
    async getSession() {
      const { data } = await client.auth.getSession();
      if (!data.session) return null;
      const profile = await fetchProfile(data.session.user.id);
      if (!profile) {
        // Cuenta desactivada o sin perfil: la sesión ya no sirve.
        await client.auth.signOut({ scope: "local" });
        return null;
      }
      return profile;
    },
    async signIn() {
      throw new Error("Con Supabase se inicia sesión con correo y contraseña");
    },
    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw toAuthError(error);
      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("Tu cuenta está desactivada. Habla con un administrador.");
      }
      return profile;
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw toAuthError(error);
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        // No se llama a Supabase dentro del callback (puede bloquear el cliente): se difiere.
        if (event === "SIGNED_OUT") listener(null);
        else if (event === "SIGNED_IN" && session)
          setTimeout(() => {
            void fetchProfile(session.user.id).then(listener, () => undefined);
          }, 0);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
