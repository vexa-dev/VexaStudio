import { canAccessStudio } from "@vexa/domain/access";
import {
  buildDoneSuggestion,
  upsertDailyUpdate,
  validateDailyInput,
} from "@vexa/domain/daily";
import { todayLima } from "@vexa/domain/dates";
import type { Id, Profile } from "@vexa/domain/types";
import type { DailyService, Services } from "@vexa/services";
import { getDb, getSessionUserId, save } from "./db";
import { delay } from "./utils";

function currentUser(): Profile {
  const user = getDb().profiles.find((p) => p.id === getSessionUserId() && p.active);
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

/**
 * Daily del mock. Espeja `daily_updates` de SQL: admin y socios leen todo, un colaborador solo lo
 * suyo; cada quien envía únicamente el suyo y solo el de hoy (Lima); reenviar el mismo día lo corrige.
 */
export function createMockDailyService(
  time: Pick<Services["time"], "listEntries">,
  tasks: Pick<Services["tasks"], "list">,
): DailyService {
  return {
    async list(filter) {
      const user = currentUser();
      const visible = getDb()
        .dailyUpdates.filter(
          (u) =>
            (canAccessStudio(user.role) || u.userId === user.id) &&
            (!filter?.userId || u.userId === filter.userId) &&
            (!filter?.date || u.date === filter.date),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      return delay(visible);
    },
    async submit(input) {
      const user = currentUser();
      const message = validateDailyInput(input);
      if (message) throw new Error(message);
      const db = getDb();
      const id: Id = `d-${crypto.randomUUID()}`;
      const { updates, update } = upsertDailyUpdate(
        db.dailyUpdates,
        user.id,
        todayLima(),
        input,
        id,
        new Date().toISOString(),
      );
      db.dailyUpdates = updates;
      save();
      return delay(update);
    },
    async suggestDone() {
      const user = currentUser();
      const [entries, list, dailies] = await Promise.all([
        time.listEntries({ userId: user.id }),
        tasks.list(),
        Promise.resolve(getDb().dailyUpdates.filter((u) => u.userId === user.id)),
      ]);
      return buildDoneSuggestion({
        userId: user.id,
        today: todayLima(),
        entries,
        tasks: list,
        dailies,
      });
    },
  };
}
