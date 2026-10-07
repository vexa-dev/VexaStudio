import type { Id, NotificationPreferences } from "@vexa/domain/types";
import type { NotificationService } from "@vexa/services";
import { getDb, getSessionUserId, save as saveDb } from "./db";
import { delay } from "./utils";

const PREFERENCES_KEY = "vexa-studio.mock.notification-preferences";

const DEFAULTS: NotificationPreferences = {
  taskAssigned: true,
  hoursReminder: true,
  weeklySummary: true,
};

type PreferencesMap = Record<Id, Partial<NotificationPreferences>>;

/** Copia en memoria: respaldo si localStorage falla. */
let cache: PreferencesMap | null = null;

function load(): PreferencesMap {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "{}");
    cache =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as PreferencesMap)
        : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save(map: PreferencesMap): void {
  cache = map;
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(map));
  } catch {
    // Sin localStorage o sin cuota: las preferencias siguen vivas en memoria.
  }
}

/** Borra las preferencias simuladas. */
export function resetNotificationPreferences(): void {
  cache = null;
  try {
    localStorage.removeItem(PREFERENCES_KEY);
  } catch {
    // Nada que borrar.
  }
}

function requireUser(): Id {
  const id = getSessionUserId();
  if (!id) throw new Error("Inicia sesión para continuar");
  return id;
}

function read(userId: Id): NotificationPreferences {
  return { ...DEFAULTS, ...load()[userId] };
}

/** Mismo tope que el adaptador de Supabase. */
const LIST_LIMIT = 50;

/**
 * Avisos y preferencias. Los avisos los escriben comentarios y reuniones en `db.notifications` (lo
 * que en Supabase hacen triggers); aquí solo se leen y se marcan, siempre solo los de la persona.
 */
export const notificationService: NotificationService = {
  async list() {
    const userId = requireUser();
    const own = getDb()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, LIST_LIMIT);
    return delay(own);
  },
  async markRead(id) {
    const userId = requireUser();
    const found = getDb().notifications.find((n) => n.id === id && n.userId === userId);
    if (!found) throw new Error("El aviso no existe o no es tuyo");
    if (!found.read) {
      found.read = true;
      saveDb();
    }
    return delay(undefined);
  },
  async markAllRead() {
    const userId = requireUser();
    let changed = false;
    for (const n of getDb().notifications)
      if (n.userId === userId && !n.read) {
        n.read = true;
        changed = true;
      }
    if (changed) saveDb();
    return delay(undefined);
  },
  async getPreferences() {
    return delay(read(requireUser()));
  },
  async updatePreferences(patch) {
    const userId = requireUser();
    const next = { ...read(userId) };
    if (patch.taskAssigned !== undefined) next.taskAssigned = patch.taskAssigned;
    if (patch.hoursReminder !== undefined) next.hoursReminder = patch.hoursReminder;
    if (patch.weeklySummary !== undefined) next.weeklySummary = patch.weeklySummary;
    save({ ...load(), [userId]: next });
    return delay(next);
  },
};
