import { canAccessStudio } from "@vexa/domain/access";
import { sortAnnouncements, validateAnnouncementText } from "@vexa/domain/comments";
import type { Profile } from "@vexa/domain/types";
import type { AnnouncementService } from "@vexa/services";
import { getDb, getSessionUserId, save } from "./db";
import { delay } from "./utils";

function currentUser(): Profile {
  const user = getDb().profiles.find((p) => p.id === getSessionUserId() && p.active);
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

function currentAdmin(): Profile {
  const user = currentUser();
  if (user.role !== "admin") throw new Error("Solo un administrador publica anuncios");
  return user;
}

/**
 * Anuncios del mock. Espeja `announcements` de SQL: los leen admin y socios (un colaborador recibe una
 * lista vacía); solo admin publica y fija o desfija; nadie borra.
 */
export const announcementService: AnnouncementService = {
  async list() {
    const user = currentUser();
    return delay(canAccessStudio(user.role) ? sortAnnouncements(getDb().announcements) : []);
  },
  async create(text, options = {}) {
    const message = validateAnnouncementText(text);
    if (message) throw new Error(message);
    const user = currentAdmin();
    const announcement = {
      id: `a-${crypto.randomUUID()}`,
      authorId: user.id,
      text: text.trim(),
      pinned: options.pinned ?? false,
      createdAt: new Date().toISOString(),
    };
    getDb().announcements.push(announcement);
    save();
    return delay(announcement);
  },
  async setPinned(id, pinned) {
    currentAdmin();
    const announcement = getDb().announcements.find((a) => a.id === id);
    if (!announcement) throw new Error("El registro no existe o no tienes permiso");
    announcement.pinned = pinned;
    save();
    return delay(announcement);
  },
};
