import {
  MEMBER_ADMIN_MESSAGES,
  checkRoleChange,
  checkSetActive,
  validateInvite,
} from "@vexa/domain/member-admin";
import type { Profile } from "@vexa/domain/types";
import type { MemberService } from "@vexa/services";
import { getDb, getSessionUserId, save } from "./db";
import { withMedia, withMediaAll } from "./profile-media";
import { delay } from "./utils";

function currentUser(): Profile {
  const user = getDb().profiles.find((p) => p.id === getSessionUserId() && p.active);
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

const activeAdmins = () => getDb().profiles.filter((p) => p.role === "admin" && p.active).length;

function requireMember(id: string): Profile {
  const member = getDb().profiles.find((p) => p.id === id);
  if (!member) throw new Error(MEMBER_ADMIN_MESSAGES.invalidMember);
  return member;
}

/**
 * Equipo del mock. Espeja `profiles` de SQL y `set_member_role` / `set_member_active`: solo un admin activo,
 * nunca sobre sí mismo, nunca dejando al estudio sin administrador activo, y desactivar exige motivo.
 * `invite` NO envía ningún correo: crea un colaborador pendiente (`pendingInvite`) que ya puede elegirse en el
 * login de demostración. Los eventos de miembros aún no se escriben en el `auditLog` del mock.
 */
export const memberService: MemberService = {
  async list() {
    return delay(withMediaAll(getDb().profiles));
  },
  async get(id) {
    const profile = getDb().profiles.find((p) => p.id === id);
    return delay(profile ? withMedia(profile) : null);
  },
  async invite(input) {
    const actor = currentUser();
    if (actor.role !== "admin") throw new Error(MEMBER_ADMIN_MESSAGES.adminOnly);
    const checked = validateInvite(input);
    if (!checked.ok) throw new Error(checked.message);
    const { email, name, area, weeklyHours, projectIds } = checked.value;
    const db = getDb();
    if (db.profiles.some((p) => p.email?.toLowerCase() === email))
      throw new Error("Ya existe una cuenta con ese correo");
    const unknown = projectIds.find((id) => !db.projects.some((p) => p.id === id));
    if (unknown) throw new Error(MEMBER_ADMIN_MESSAGES.invalidProjects);
    const profile: Profile = {
      id: `u-${crypto.randomUUID()}`,
      name,
      role: "collaborator",
      area,
      weeklyHours,
      active: true,
      email,
      pendingInvite: true,
      joinedAt: new Date().toISOString(),
    };
    db.profiles.push(profile);
    for (const project of db.projects)
      if (projectIds.includes(project.id))
        project.memberIds = [...new Set([...(project.memberIds ?? []), profile.id])];
    save();
    return delay(withMedia(profile));
  },
  async setRole(memberId, role) {
    const actor = currentUser();
    const target = requireMember(memberId);
    const problem = checkRoleChange({ actor, target, role, activeAdminCount: activeAdmins() });
    if (problem) throw new Error(problem);
    target.role = role;
    save();
    return delay(withMedia(target));
  },
  async setActive(memberId, active, reason) {
    const actor = currentUser();
    const target = requireMember(memberId);
    const problem = checkSetActive({ actor, target, active, reason, activeAdminCount: activeAdmins() });
    if (problem) throw new Error(problem);
    target.active = active;
    save();
    return delay(withMedia(target));
  },
};
