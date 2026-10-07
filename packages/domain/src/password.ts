/** Política de contraseñas: misma regla que `supabase/config.toml` (12+ con minúscula, mayúscula y dígito). */
export const PASSWORD_MIN_LENGTH = 12;
const EMAIL_MAX_LENGTH = 254;

/** Primer problema de la contraseña, en español, o `null` si cumple. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (!/[a-z]/.test(password)) return "La contraseña debe incluir al menos una minúscula.";
  if (!/[A-Z]/.test(password)) return "La contraseña debe incluir al menos una mayúscula.";
  if (!/\d/.test(password)) return "La contraseña debe incluir al menos un número.";
  return null;
}

/** Correo recortado y en minúsculas, o `null` si no tiene forma de correo. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
