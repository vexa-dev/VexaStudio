import type { AuthService } from "@vexa/services";
import { getDb, getSessionUserId, save } from "./db";
import { withMedia } from "./profile-media";
import { delay, supabaseOnly } from "./utils";

/** Mismas reglas que la base (`update_my_profile`), con los mismos mensajes. */
const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
const NAME_MAX = 80;
const BIO_MAX = 280;

type ProfileDetails = Parameters<AuthService["updateProfile"]>[0];

/** Guarda nombre, usuario y bio de la persona con sesión; el usuario es único sin importar mayúsculas. */
function updateProfile(input: ProfileDetails) {
  const userId = getSessionUserId();
  const db = getDb();
  const profile = userId ? db.profiles.find((p) => p.id === userId && p.active) : undefined;
  if (!profile) throw new Error("Inicia sesión para continuar");

  const name = input.name.trim();
  const username = input.username?.trim().toLowerCase() || null;
  const bio = input.bio?.trim() || null;
  if (!name || name.length > NAME_MAX)
    throw new Error(`El nombre debe tener de 1 a ${NAME_MAX} caracteres`);
  if (username !== null && !USERNAME_PATTERN.test(username))
    throw new Error("El usuario debe tener de 3 a 30 caracteres: letras, números, punto o guion bajo");
  if (bio !== null && bio.length > BIO_MAX)
    throw new Error(`La biografía puede tener hasta ${BIO_MAX} caracteres`);
  if (username !== null && db.profiles.some((p) => p.id !== profile.id && p.username === username))
    throw new Error("Ese usuario ya está en uso");

  profile.name = name;
  profile.username = username;
  profile.bio = bio;
  save();
  return withMedia(profile);
}

/**
 * Parte de `AuthService` que el mock implementa para el perfil propio. Contraseña, segundo paso y
 * cierre de otras sesiones no se pueden simular: avisan que requieren Supabase.
 */
export const profileAuth: Pick<
  AuthService,
  | "updateProfile"
  | "updatePassword"
  | "signOutOthers"
  | "listSessions"
  | "revokeSession"
  | "listMfaFactors"
  | "enrollMfa"
  | "verifyMfaEnrollment"
  | "disableMfa"
  | "getMfaChallenge"
  | "verifyMfaLogin"
> = {
  async updateProfile(input) {
    return delay(updateProfile(input));
  },
  updatePassword: supabaseOnly,
  signOutOthers: supabaseOnly,
  listSessions: supabaseOnly,
  revokeSession: supabaseOnly,
  listMfaFactors: supabaseOnly,
  enrollMfa: supabaseOnly,
  verifyMfaEnrollment: supabaseOnly,
  disableMfa: supabaseOnly,
  // El mock no tiene segundo paso: nunca se exige, así que el acceso simulado sigue igual.
  async getMfaChallenge() {
    return { required: false };
  },
  verifyMfaLogin: supabaseOnly,
};
