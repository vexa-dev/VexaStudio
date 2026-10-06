import type {
  Id,
  MfaChallenge,
  MfaEnrollment,
  MfaFactor,
  Profile,
} from "@vexa/domain/types";
import type { AuthService } from "@vexa/services";
import { createSupabaseClient, type VexaSupabase } from "@/lib/supabase";
import type { Tables } from "./database.types";
import { toServiceError, translatePasswordChange, unwrap, unwrapMaybe } from "./errors";
import { isoInstant } from "./mappers";
import {
  clearProfileImage,
  createSignedUrlResolver,
  dataUrlToBlob,
  uploadProfileImage,
  withSignedMedia,
  type SignedUrlResolver,
} from "./profile-media";
import { requireUserId } from "./session";

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

/**
 * La contraseña ya fue aceptada, pero la cuenta tiene un factor TOTP verificado y la sesión sigue
 * en aal1. La interfaz no debe dar acceso: pide el código y llama a `verifyMfaLogin(factorId, code)`.
 *
 * SEGURIDAD: este segundo paso se exige solo en el cliente. El RLS no pide aal2, así que quien tenga
 * un factor aún puede llamar a la API REST con su token aal1. Endurecer las políticas con aal2 queda
 * como tarea aparte (riesgo conocido).
 */
export class MfaRequiredError extends Error {
  readonly factorId: Id | undefined;
  constructor(factorId?: Id) {
    super("Confirma tu identidad con el código de tu app autenticadora.");
    this.name = "MfaRequiredError";
    this.factorId = factorId;
  }
}

/** Ayudas de prueba: cómo se comprueba la contraseña actual sin tocar la sesión en curso. */
export interface AuthServiceDeps {
  verifyCurrentPassword?: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthErrorLike | null }>;
}

const PASSWORD_MIN_LENGTH = 12;
const MFA_FRIENDLY_NAME = "Vexa Studio";

/** Misma regla que `supabase/config.toml` (mínimo 12 con minúsculas, mayúsculas y dígitos). */
export function validateNewPassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH)
    throw new Error(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (!/[a-z]/.test(password))
    throw new Error("La contraseña debe incluir al menos una minúscula.");
  if (!/[A-Z]/.test(password))
    throw new Error("La contraseña debe incluir al menos una mayúscula.");
  if (!/\d/.test(password))
    throw new Error("La contraseña debe incluir al menos un número.");
}

function normalizeMfaCode(code: string): string {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) throw new Error("Escribe el código de 6 dígitos.");
  return clean;
}

/**
 * Comprueba la contraseña actual con un cliente aparte y sin sesión guardada: así la sesión en
 * curso (que puede ser aal2) no se degrada a aal1 y `updateUser` no pierde el segundo paso. Sin
 * variables de entorno (pruebas de integración) se usa el cliente de la aplicación.
 */
function defaultPasswordVerifier(client: VexaSupabase): NonNullable<AuthServiceDeps["verifyCurrentPassword"]> {
  return async (email, password) => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return client.auth.signInWithPassword({ email, password });
    const isolated = createSupabaseClient(url, key, { persistSession: false });
    const result = await isolated.auth.signInWithPassword({ email, password });
    // Revoca la sesión de comprobación en el servidor (solo esa).
    if (!result.error) await isolated.auth.signOut({ scope: "local" });
    return { error: result.error };
  };
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
  const password = translatePasswordChange(message);
  if (password) return new Error(password, { cause: error });
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
  if (code === "weak_password" || /password (is too weak|should contain)/i.test(message))
    return new Error(
      "La contraseña debe tener al menos 12 caracteres, con mayúsculas, minúsculas y números.",
      { cause: error },
    );
  if (code === "same_password" || /different from the old password/i.test(message))
    return new Error("La nueva contraseña debe ser distinta de la actual.", { cause: error });
  if (code === "mfa_verification_failed" || /invalid totp code/i.test(message))
    return new Error("El código no es correcto o venció. Inténtalo de nuevo.", { cause: error });
  if (code === "mfa_challenge_expired")
    return new Error("El código venció. Inténtalo de nuevo.", { cause: error });
  if (code === "insufficient_aal")
    return new Error("Confirma el segundo paso para continuar.", { cause: error });
  if (code === "mfa_factor_name_conflict")
    return new Error("Ya hay un alta en curso. Inténtalo de nuevo.", { cause: error });
  if (code === "mfa_totp_enroll_not_enabled" || code === "mfa_totp_verify_not_enabled")
    return new Error("El segundo paso no está disponible en este momento.", { cause: error });
  return toServiceError(error);
}

export function createAuthService(
  client: VexaSupabase,
  resolver: SignedUrlResolver = createSignedUrlResolver(client),
  deps: AuthServiceDeps = {},
): CredentialsAuthService {
  const verifyCurrentPassword = deps.verifyCurrentPassword ?? defaultPasswordVerifier(client);

  /** Perfil activo con su foto y banner firmados; RLS no devuelve los inactivos. */
  async function fetchProfile(id: string): Promise<Profile | null> {
    const row = unwrapMaybe(
      await client.from("profiles").select("*").eq("id", id).maybeSingle(),
    );
    const profile = row ? ((await withSignedMedia(resolver, [row]))[0] ?? null) : null;
    if (!profile) return null;
    // The email lives in the auth session, not in `profiles`; only the signed-in person gets their own.
    const session = (await client.auth.getSession()).data.session;
    return session?.user.id === id ? { ...profile, email: session.user.email ?? null } : profile;
  }

  /** ¿Falta el segundo paso? aal1 con un factor verificado (nextLevel aal2). */
  async function readMfaChallenge(): Promise<MfaChallenge> {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    // Sin sesión no hay nada que confirmar.
    if (error || !data) return { required: false };
    if (data.currentLevel !== "aal1" || data.nextLevel !== "aal2") return { required: false };
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw toAuthError(factors.error);
    const factorId = factors.data?.totp[0]?.id;
    return factorId ? { required: true, factorId } : { required: true };
  }

  async function verifyMfa(factorId: Id, code: string): Promise<void> {
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId,
      code: normalizeMfaCode(code),
    });
    if (error) throw toAuthError(error);
  }

  return {
    async listLoginProfiles() {
      // Sin sesión no se puede leer el equipo (RLS): el acceso es por correo y contraseña.
      return [];
    },
    async getSession() {
      const { data } = await client.auth.getSession();
      if (!data.session) return null;
      // Con el segundo paso pendiente la sesión se conserva (hace falta para verificar) pero no
      // se entrega perfil: la interfaz vuelve al acceso y pide el código.
      if ((await readMfaChallenge()).required) return null;
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
      // Una cuenta con segundo paso no recibe acceso completo solo con la contraseña.
      const challenge = await readMfaChallenge();
      if (challenge.required) throw new MfaRequiredError(challenge.factorId);
      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("Tu cuenta está desactivada. Habla con un administrador.");
      }
      return profile;
    },
    async signOut() {
      resolver.clear();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw toAuthError(error);
    },
    async updateProfileMedia(patch) {
      const userId = await requireUserId(client);
      // Se valida todo antes de subir nada: una imagen mala no deja la otra a medias.
      for (const value of [patch.avatarUrl, patch.bannerUrl])
        if (typeof value === "string") dataUrlToBlob(value);
      const targets = [
        { kind: "avatar", value: patch.avatarUrl },
        { kind: "banner", value: patch.bannerUrl },
      ] as const;
      let latest: Tables<"profiles"> | null = null;
      for (const { kind, value } of targets) {
        if (typeof value === "string")
          latest = await uploadProfileImage(client, { userId, kind, dataUrl: value });
        else if (value === null)
          latest = await clearProfileImage(client, { userId, kind });
      }
      // La última fila de la RPC ya trae ambas rutas; sin cambios se lee el perfil.
      const profile = latest
        ? ((await withSignedMedia(resolver, [latest]))[0] ?? null)
        : await fetchProfile(userId);
      if (!profile) throw new Error("Inicia sesión para continuar");
      return profile;
    },
    async updateProfile(input) {
      const userId = await requireUserId(client);
      const row = unwrap(
        await client.rpc("update_my_profile", {
          p_name: input.name,
          // El RPC trata el vacío como nulo; `null` no cabe en el tipo generado.
          p_username: input.username ?? undefined,
          p_bio: input.bio ?? undefined,
        }),
      );
      const profile = (await withSignedMedia(resolver, [row]))[0];
      if (!profile || profile.id !== userId) throw new Error("Inicia sesión para continuar");
      return profile;
    },
    async updatePassword({ currentPassword, newPassword }) {
      if (!currentPassword) throw new Error("Escribe tu contraseña actual.");
      validateNewPassword(newPassword);
      const { data } = await client.auth.getSession();
      const email = data.session?.user.email;
      if (!email) throw new Error("Inicia sesión para continuar");
      const { error: reauthError } = await verifyCurrentPassword(email, currentPassword);
      if (reauthError) {
        if (reauthError.code === "invalid_credentials" || /invalid login credentials/i.test(reauthError.message ?? ""))
          throw new Error("La contraseña actual no es correcta.", { cause: reauthError });
        throw toAuthError(reauthError);
      }
      const { error } = await client.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) throw toAuthError(error);
    },
    async signOutOthers() {
      const { error } = await client.auth.signOut({ scope: "others" });
      if (error) throw toAuthError(error);
    },
    async listMfaFactors() {
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw toAuthError(error);
      return (data?.all ?? [])
        .filter((f) => f.factor_type === "totp")
        .map(
          (f): MfaFactor => ({
            id: f.id,
            friendlyName: f.friendly_name ?? null,
            status: f.status === "verified" ? "verified" : "unverified",
            createdAt: isoInstant(f.created_at),
          }),
        );
    },
    async enrollMfa(): Promise<MfaEnrollment> {
      const { data: listed, error: listError } = await client.auth.mfa.listFactors();
      if (listError) throw toAuthError(listError);
      const totp = (listed?.all ?? []).filter((f) => f.factor_type === "totp");
      if (totp.some((f) => f.status === "verified"))
        throw new Error("El segundo paso ya está activado.");
      // Un alta abandonada bloquea el nombre del factor: se descarta antes de empezar otra.
      for (const stale of totp) {
        const { error } = await client.auth.mfa.unenroll({ factorId: stale.id });
        if (error) throw toAuthError(error);
      }
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: MFA_FRIENDLY_NAME,
      });
      if (error || !data) throw toAuthError(error ?? { message: "enroll" });
      // El secreto solo se devuelve a la interfaz para mostrarlo; nunca se registra ni se guarda.
      return {
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      };
    },
    async verifyMfaEnrollment(factorId, code) {
      await verifyMfa(factorId, code);
    },
    async disableMfa(factorId) {
      const { error } = await client.auth.mfa.unenroll({ factorId });
      if (error) throw toAuthError(error);
    },
    getMfaChallenge: readMfaChallenge,
    async verifyMfaLogin(factorId, code) {
      await verifyMfa(factorId, code);
      const userId = await requireUserId(client);
      const profile = await fetchProfile(userId);
      if (!profile) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("Tu cuenta está desactivada. Habla con un administrador.");
      }
      return profile;
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        // No se llama a Supabase dentro del callback (puede bloquear el cliente): se difiere.
        if (event === "SIGNED_OUT") listener(null);
        else if (event === "SIGNED_IN" && session)
          setTimeout(() => {
            // Con el segundo paso pendiente no se entrega perfil: lo hace `verifyMfaLogin`.
            void readMfaChallenge()
              .then((challenge) =>
                challenge.required ? undefined : fetchProfile(session.user.id).then(listener),
              )
              .catch(() => undefined);
          }, 0);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
