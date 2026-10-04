import type { TimeService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import type { Json } from "./database.types";
import { unwrap, unwrapMaybe } from "./errors";
import { mapDraft, mapTimeEntry, mapTimeEntryOrNull } from "./mappers";
import { requireUserId } from "./session";

/** Un solo temporizador por persona: las escrituras del reloj no se mezclan entre pestañas. */
async function timerLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("vexa.timer.write", operation);
  return operation();
}

/**
 * Horas y reloj. Las transiciones atómicas (iniciar, pausar, confirmar borradores...) son RPC con
 * las mismas reglas que el mock; las guardas de la base impiden editar lo ajeno o lo pagado.
 */
export function createTimeService(client: VexaSupabase): TimeService {
  return {
    pause: () =>
      timerLock(async () =>
        mapTimeEntryOrNull(unwrapMaybe(await client.rpc("pause_timer"))),
      ),
    resume: () =>
      timerLock(async () =>
        mapTimeEntryOrNull(unwrapMaybe(await client.rpc("resume_timer"))),
      ),
    async listDrafts() {
      const userId = await requireUserId(client);
      const rows = unwrap(
        await client
          .from("hours_drafts")
          .select("*")
          .eq("user_id", userId)
          .is("submitted_at", null)
          .order("created_at")
          .order("id"),
      );
      return rows.map(mapDraft);
    },
    submitDrafts: (input) =>
      timerLock(async () =>
        mapTimeEntry(
          unwrap(
            await client.rpc("submit_hours_drafts", {
              p_items: input.items as unknown as Json,
              p_date: input.date,
              p_description: input.description,
            }),
          ),
        ),
      ),
    async listEntries(filter = {}) {
      // Las sesiones de reloj en borrador no cuentan en el historial; RLS decide de quién se ven.
      let query = client.from("time_entries").select("*").eq("draft", false);
      if (filter.userId) query = query.eq("user_id", filter.userId);
      if (filter.taskId) query = query.eq("task_id", filter.taskId);
      if (filter.from) query = query.gte("started_at", filter.from);
      if (filter.to) query = query.lte("started_at", filter.to);
      const rows = unwrap(await query.order("created_at").order("id"));
      return rows.map(mapTimeEntry);
    },
    async getRunning() {
      const userId = await requireUserId(client);
      const row = unwrapMaybe(
        await client
          .from("time_entries")
          .select("*")
          .eq("user_id", userId)
          .is("ended_at", null)
          .is("voided_at", null)
          .maybeSingle(),
      );
      return row ? mapTimeEntry(row) : null;
    },
    start: (taskId, activity) =>
      timerLock(async () =>
        mapTimeEntry(
          unwrap(
            await client.rpc("start_timer", {
              p_task: taskId ?? undefined,
              p_description: activity?.description,
              p_project: activity?.projectId ?? undefined,
              p_evidence_url: activity?.evidenceUrl ?? undefined,
            }),
          ),
        ),
      ),
    stop: () =>
      timerLock(async () =>
        mapTimeEntryOrNull(unwrapMaybe(await client.rpc("stop_timer"))),
      ),
    async addManual(input) {
      return mapTimeEntry(
        unwrap(
          await client.rpc("add_manual_hours", {
            // El tipo generado exige `string`, pero la función acepta NULL (actividad sin tarea).
            p_task: input.taskId as string,
            p_date: input.date,
            p_hours: input.hours,
            p_project: input.projectId ?? undefined,
            p_description: input.description,
            p_evidence_url: input.evidenceUrl ?? undefined,
            p_start_time: input.startTime,
          }),
        ),
      );
    },
    async update(id, patch) {
      // Una clave ausente no cambia; `null` vacía el campo (como el parche del dominio).
      const body: Record<string, Json | undefined> = {
        taskId: patch.taskId,
        hours: patch.hours,
        startedAt: patch.startedAt,
        description: patch.description,
        projectId: patch.projectId,
        evidenceUrl: patch.evidenceUrl,
      };
      const p_patch = Object.fromEntries(
        Object.entries(body).filter(([, value]) => value !== undefined),
      ) as Json;
      return mapTimeEntry(unwrap(await client.rpc("update_hours", { p_id: id, p_patch })));
    },
    async void(id, reason) {
      return mapTimeEntry(
        unwrap(await client.rpc("void_hours", { p_id: id, p_reason: reason })),
      );
    },
    async validate(entryIds) {
      const rows = unwrap(
        await client.rpc("validate_hours", { p_ids: [...new Set(entryIds)] }),
      );
      return rows.map(mapTimeEntry);
    },
    async requestClarification(id, note) {
      return mapTimeEntry(
        unwrap(await client.rpc("request_hours_clarification", { p_id: id, p_note: note })),
      );
    },
  };
}
