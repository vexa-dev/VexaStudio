import { z } from "zod";
import type { ProfileDetailsInput } from "@vexa/domain/types";

export const BIO_MAX_LENGTH = 280;
export const MFA_CODE_LENGTH = 6;
const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export const profileFormSchema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(80, "Máximo 80 caracteres"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => value === "" || USERNAME_PATTERN.test(value),
      "Usa de 3 a 30 caracteres: letras minúsculas, números, punto o guion bajo",
    ),
  bio: z.string().max(BIO_MAX_LENGTH, `Máximo ${BIO_MAX_LENGTH} caracteres`),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/** Empty optional fields travel as `null`, as the service contract expects. */
export function toProfileInput(values: ProfileFormValues): ProfileDetailsInput {
  const username = values.username.trim().toLowerCase();
  const bio = values.bio.trim();
  return { name: values.name.trim(), username: username || null, bio: bio || null };
}

/** Misma política que `passwordProblem` (dominio) y que la base: 12+ con minúscula, mayúscula y número. */
const newPasswordField = z
  .string()
  .min(12, "Usa al menos 12 caracteres")
  .regex(/[a-z]/, "Incluye al menos una minúscula")
  .regex(/[A-Z]/, "Incluye al menos una mayúscula")
  .regex(/\d/, "Incluye al menos un número");

export const resetPasswordSchema = z
  .object({ newPassword: newPasswordField, confirmPassword: z.string() })
  .refine((v) => v.confirmPassword === v.newPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
    newPassword: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.confirmPassword === v.newPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  })
  .refine((v) => v.newPassword === "" || v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "La nueva contraseña debe ser distinta de la actual",
  });
export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Escribe el código de 6 dígitos"),
});
export type MfaCodeValues = z.infer<typeof mfaCodeSchema>;

/** Keeps only digits (pasted codes often carry spaces or dashes) and caps the length. */
export function normalizeCodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, MFA_CODE_LENGTH);
}

/**
 * Image source for the enrollment QR. Supabase returns a data URL; raw SVG markup is wrapped
 * defensively and anything else is rejected so it can never become a script-bearing URL.
 */
export function qrImageSrc(qr: string): string {
  if (qr.startsWith("data:image/svg+xml")) return qr;
  if (qr.trimStart().startsWith("<svg"))
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
  return "";
}
