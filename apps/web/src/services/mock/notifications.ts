import type { Id, NotificationPreferences } from "@vexa/domain/types";
import type { NotificationService } from "@vexa/services";
import { getSessionUserId } from "./db";
import { delay, notImplemented } from "./utils";

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

const pending = notImplemented<NotificationService>("NotificationService");

/**
 * Avisos y preferencias. Las preferencias funcionan y persisten; la lista de avisos sigue
 * pendiente en el mock (los avisos reales los crean triggers de Supabase).
 */
export const notificationService: NotificationService = {
  list: () => pending.list(),
  markRead: (id) => pending.markRead(id),
  markAllRead: () => pending.markAllRead(),
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
