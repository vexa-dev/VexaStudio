import { normalizeEmail } from "./password";
import type { Area, Id, Role } from "./types";

/** Reglas puras de la gestión de miembros (invitar, cambiar rol, activar/desactivar). */

export const MEMBER_NAME_MAX = 80;
export const MEMBER_WEEKLY_HOURS_MAX = 60;
export const INVITE_MAX_PROJECTS = 20;
export const DEACTIVATION_REASON_MAX = 280;

export const MEMBER_AREAS: readonly Area[] = [
  "technical",
  "management_finance",
  "commercial",
  "design_marketing",
];

/**
 * Solo se invita a colaboradores: los socios entran tras una votación (PRD) y un administrador los
 * promueve después con `setRole`. Admin tampoco es invitable.
 */
export const INVITABLE_ROLES = ["collaborator"] as const;

/** Mensajes en español (Perú). Los de SQL repiten el texto sin acentos y `errors.ts` los restituye. */
export const MEMBER_ADMIN_MESSAGES = {
  adminOnly: "Solo un administrador gestiona al equipo",
  selfRole: "No puedes cambiar tu propio rol",
  selfDeactivate: "No puedes desactivarte a ti mismo",
  lastAdmin: "Debe quedar al menos un administrador activo",
  targetInactive: "Reactiva a la persona antes de cambiar su rol",
  reasonRequired: "Escribe el motivo de la desactivación",
  reasonTooLong: "El motivo puede tener hasta 280 caracteres",
  invalidMember: "Miembro no válido",
  invalidEmail: "Escribe un correo válido",
  invalidName: "El nombre debe tener de 1 a 80 caracteres",
  invalidHours: "Las horas por semana deben estar entre 0 y 60",
  invalidArea: "Elige un área válida",
  roleNotInvitable: "Solo se puede invitar a colaboradores",
  invalidProjects: "Revisa los proyectos elegidos",
  tooManyProjects: "Puedes elegir hasta 20 proyectos",
} as const;

export interface InviteInput {
  email: string;
  name: string;
  role?: string;
  area?: string;
  weeklyHours?: number;
  projectIds?: readonly Id[];
}

export interface NormalizedInvite {
  email: string;
  name: string;
  role: "collaborator";
  area: Area;
  weeklyHours: number;
  projectIds: Id[];
}

export type InviteValidation =
  | { ok: true; value: NormalizedInvite }
  | { ok: false; message: string };

const fail = (message: string): InviteValidation => ({ ok: false, message });

/** Normaliza la invitación y devuelve el primer problema, si lo hay. */
export function validateInvite(input: InviteInput): InviteValidation {
  const email = normalizeEmail(input.email);
  if (!email) return fail(MEMBER_ADMIN_MESSAGES.invalidEmail);
  const name = input.name.trim();
  if (name.length === 0 || name.length > MEMBER_NAME_MAX) return fail(MEMBER_ADMIN_MESSAGES.invalidName);
  const role = input.role ?? "collaborator";
  if (!(INVITABLE_ROLES as readonly string[]).includes(role)) return fail(MEMBER_ADMIN_MESSAGES.roleNotInvitable);
  const area = input.area ?? "technical";
  if (!(MEMBER_AREAS as readonly string[]).includes(area)) return fail(MEMBER_ADMIN_MESSAGES.invalidArea);
  const weeklyHours = input.weeklyHours ?? 0;
  if (!Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > MEMBER_WEEKLY_HOURS_MAX)
    return fail(MEMBER_ADMIN_MESSAGES.invalidHours);
  const projectIds = [...(input.projectIds ?? [])];
  if (projectIds.length > INVITE_MAX_PROJECTS) return fail(MEMBER_ADMIN_MESSAGES.tooManyProjects);
  if (projectIds.some((id) => id.trim() === "") || new Set(projectIds).size !== projectIds.length)
    return fail(MEMBER_ADMIN_MESSAGES.invalidProjects);
  return {
    ok: true,
    value: { email, name, role: "collaborator", area: area as Area, weeklyHours, projectIds },
  };
}

interface Actor {
  id: Id;
  role: Role;
  active: boolean;
}

/** `activeAdminCount`: administradores activos antes del cambio. */
export function checkRoleChange(args: {
  actor: Actor;
  target: Actor;
  role: Role;
  activeAdminCount: number;
}): string | null {
  const { actor, target, role, activeAdminCount } = args;
  if (actor.role !== "admin" || !actor.active) return MEMBER_ADMIN_MESSAGES.adminOnly;
  if (actor.id === target.id) return MEMBER_ADMIN_MESSAGES.selfRole;
  if (!target.active) return MEMBER_ADMIN_MESSAGES.targetInactive;
  if (target.role === "admin" && role !== "admin" && activeAdminCount <= 1)
    return MEMBER_ADMIN_MESSAGES.lastAdmin;
  return null;
}

export function checkSetActive(args: {
  actor: Actor;
  target: Actor;
  active: boolean;
  reason?: string;
  activeAdminCount: number;
}): string | null {
  const { actor, target, active, activeAdminCount } = args;
  if (actor.role !== "admin" || !actor.active) return MEMBER_ADMIN_MESSAGES.adminOnly;
  if (actor.id === target.id) return active ? null : MEMBER_ADMIN_MESSAGES.selfDeactivate;
  if (active) return null;
  const reason = (args.reason ?? "").trim();
  if (reason === "") return MEMBER_ADMIN_MESSAGES.reasonRequired;
  if (reason.length > DEACTIVATION_REASON_MAX) return MEMBER_ADMIN_MESSAGES.reasonTooLong;
  if (target.role === "admin" && target.active && activeAdminCount <= 1) return MEMBER_ADMIN_MESSAGES.lastAdmin;
  return null;
}

const ROLE_CONFIRMATION: Record<Role, string> = {
  admin: "ADMINISTRADOR",
  partner: "SOCIO",
  collaborator: "COLABORADOR",
};

/** Texto que quien administra debe escribir para confirmar un cambio de rol. */
export function roleConfirmationText(role: Role): string {
  return ROLE_CONFIRMATION[role];
}
