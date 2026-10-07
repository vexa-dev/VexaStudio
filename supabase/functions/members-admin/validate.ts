// Validacion pura de la Edge Function `members-admin`. Sin APIs de Deno: la importa tambien Vitest.
// Repite a proposito las pocas reglas de `packages/domain/src/member-admin.ts` (las funciones de
// Supabase se empaquetan solas y no importan codigo de `packages/`); una prueba de paridad en
// `apps/web/src/services/supabase/members.test.ts` las mantiene iguales.

export const AREAS = ["technical", "management_finance", "commercial", "design_marketing"] as const;
export type Area = (typeof AREAS)[number];

const NAME_MAX = 80;
const HOURS_MAX = 60;
const MAX_PROJECTS = 20;
const EMAIL_MAX = 254;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InvitePayload {
  email: string;
  name: string;
  role: "collaborator";
  area: Area;
  weeklyHours: number;
  projectIds: string[];
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const bad = (message: string): { ok: false; message: string } => ({ ok: false, message });

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function parseInvite(body: Record<string, unknown>): Parsed<InvitePayload> {
  const email = normalizeEmail(body.email);
  if (!email) return bad("Escribe un correo válido");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0 || name.length > NAME_MAX) return bad("El nombre debe tener de 1 a 80 caracteres");
  const role = body.role ?? "collaborator";
  if (role !== "collaborator") return bad("Solo se puede invitar a colaboradores");
  const area = body.area ?? "technical";
  if (typeof area !== "string" || !(AREAS as readonly string[]).includes(area)) return bad("Elige un área válida");
  const weeklyHours = body.weeklyHours ?? 0;
  if (typeof weeklyHours !== "number" || !Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > HOURS_MAX)
    return bad("Las horas por semana deben estar entre 0 y 60");
  const projectIds = body.projectIds ?? [];
  if (!Array.isArray(projectIds)) return bad("Revisa los proyectos elegidos");
  if (projectIds.length > MAX_PROJECTS) return bad("Puedes elegir hasta 20 proyectos");
  if (!projectIds.every((id) => typeof id === "string" && UUID.test(id)) || new Set(projectIds).size !== projectIds.length)
    return bad("Revisa los proyectos elegidos");
  return { ok: true, value: { email, name, role: "collaborator", area: area as Area, weeklyHours, projectIds: projectIds as string[] } };
}

export function parseMemberId(body: Record<string, unknown>): Parsed<string> {
  return typeof body.memberId === "string" && UUID.test(body.memberId)
    ? { ok: true, value: body.memberId }
    : bad("Miembro no válido");
}

/** El origen de la peticion solo se usa para `redirectTo` si esta en la lista de permitidos. */
export function pickOrigin(requested: string | null, allowed: readonly string[]): string | null {
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] ?? null;
}

/** Errores de GoTrue que significan "ya hay una cuenta con ese correo" (sin revelar si esta activa). */
export function isAlreadyRegistered(error: { status?: number; code?: string; message?: string }): boolean {
  if (error.code === "email_exists" || error.code === "user_already_exists") return true;
  return /already (been )?registered|already exists/i.test(error.message ?? "");
}
