import {
  buildDoneSuggestion,
  normalizeDailyInput,
  validateDailyInput,
} from "@vexa/domain/daily";
import { todayLima } from "@vexa/domain/dates";
import type { DailyService, Services } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import type { Tables } from "./database.types";
import { unwrap } from "./errors";
import { mapDailyUpdate } from "./mappers";
import { requireUserId } from "./session";

/**
 * Daily compartido sobre `daily_updates`. RLS decide quién ve qué (admin y socios todo, un colaborador
 * lo suyo) y la base exige que el envío sea el propio y de hoy en Lima; aquí solo se arma la consulta.
 * `suggestDone` usa los servicios de horas y tareas para dar el mismo texto que el mock.
 */
export function createDailyService(
  client: VexaSupabase,
  deps: {
    time: Pick<Services["time"], "listEntries">;
    tasks: Pick<Services["tasks"], "list">;
  },
): DailyService {
  return {
    async list(filter = {}) {
      await requireUserId(client);
      let query = client.from("daily_updates").select("*");
      if (filter.userId) query = query.eq("user_id", filter.userId);
      if (filter.date) query = query.eq("date", filter.date);
      const rows = unwrap(
        await query.order("date", { ascending: false }).order("created_at").order("id"),
      );
      return rows.map(mapDailyUpdate);
    },
    async submit(input) {
      const message = validateDailyInput(input);
      if (message) throw new Error(message);
      await requireUserId(client);
      const fields = normalizeDailyInput(input);
      // `user_id` sale de la sesión (default auth.uid()); la base rechaza una fecha distinta de hoy.
      const row = unwrap(
        await client
          .from("daily_updates")
          .upsert(
            {
              date: todayLima(),
              done: fields.done,
              will_do: fields.willDo,
              blockers: fields.blockers,
            },
            { onConflict: "user_id,date" },
          )
          .select("*")
          .single()
          .overrideTypes<Tables<"daily_updates">, { merge: false }>(),
      );
      return mapDailyUpdate(row);
    },
    async suggestDone() {
      const userId = await requireUserId(client);
      const [entries, tasks, rows] = await Promise.all([
        deps.time.listEntries({ userId }),
        deps.tasks.list(),
        client.from("daily_updates").select("*").eq("user_id", userId),
      ]);
      return buildDoneSuggestion({
        userId,
        today: todayLima(),
        entries,
        tasks,
        dailies: unwrap(rows).map(mapDailyUpdate),
      });
    },
  };
}
