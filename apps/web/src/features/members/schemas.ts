import { z } from "zod";
import {
  DEACTIVATION_REASON_MAX,
  INVITE_MAX_PROJECTS,
  MEMBER_ADMIN_MESSAGES as MSG,
  MEMBER_AREAS,
  MEMBER_NAME_MAX,
  MEMBER_WEEKLY_HOURS_MAX,
} from "@vexa/domain/member-admin";
import { normalizeEmail } from "@vexa/domain/password";
import type { Area } from "@vexa/domain/types";

/** Invitación de un colaborador. Los mensajes son los del dominio, para que la UI y el servicio coincidan. */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Escribe el correo")
    .refine((value) => normalizeEmail(value) !== null, MSG.invalidEmail),
  name: z.string().trim().min(1, "Escribe el nombre").max(MEMBER_NAME_MAX, MSG.invalidName),
  area: z.enum(MEMBER_AREAS as [Area, ...Area[]], MSG.invalidArea),
  weeklyHours: z
    .number(MSG.invalidHours)
    .min(0, MSG.invalidHours)
    .max(MEMBER_WEEKLY_HOURS_MAX, MSG.invalidHours),
  projectIds: z.array(z.string()).max(INVITE_MAX_PROJECTS, MSG.tooManyProjects),
});
export type InviteFormValues = z.infer<typeof inviteSchema>;

/** Cambio de rol: hay que escribir el texto de confirmación del rol nuevo (p. ej. `SOCIO`). */
export function roleChangeSchema(expected: string) {
  return z.object({
    confirmation: z
      .string()
      .refine((value) => value.trim().toUpperCase() === expected, `Escribe ${expected} para confirmar`),
    note: z.string().trim().max(DEACTIVATION_REASON_MAX, MSG.reasonTooLong),
  });
}
export type RoleChangeValues = z.infer<ReturnType<typeof roleChangeSchema>>;

/** Desactivar exige un motivo; queda en el registro de actividad. */
export const deactivateSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, MSG.reasonRequired)
    .max(DEACTIVATION_REASON_MAX, MSG.reasonTooLong),
});
export type DeactivateValues = z.infer<typeof deactivateSchema>;
