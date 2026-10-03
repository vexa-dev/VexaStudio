import { canAccessStudio } from "@/domain/access";
import { getDb, getSessionUserId } from "./db";

export function requireStudioAccess() {
  const user = getDb().profiles.find(
    (p) => p.id === getSessionUserId() && p.active,
  );
  if (!canAccessStudio(user?.role))
    throw new Error(
      "Solo los socios y administradores tienen acceso a la información del estudio.",
    );
}
