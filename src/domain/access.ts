import type { Role } from "./types";

/** Gastos, equipo y participación corresponden a socios y administradores. */
export function canAccessStudio(role: Role | undefined) {
  return role === "admin" || role === "partner";
}
