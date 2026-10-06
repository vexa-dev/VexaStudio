import { validateEvidenceFile } from "@vexa/domain/hours-evidence";
import type { TimeEntry } from "@vexa/domain/types";
import type { HoursParticipantInput, TimeService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import {
  decodeAttachment,
  removeChatObject,
  safeFilename,
  STORAGE_CACHE_CONTROL,
} from "./chat-media";
import type { Json, Tables } from "./database.types";
import { toServiceError, unwrap, unwrapMaybe } from "./errors";
import {
  mapDraft,
  mapEvidence,
  mapTimeEntry,
  mapTimeEntryOrNull,
  TIME_ENTRY_SELECT,
} from "./mappers";
import { requireUserId } from "./session";

const EVIDENCE_BUCKET = "hours-evidence";
const EVIDENCE_SIGN_TTL_SECONDS = 3600;
/** Files removed per sweep: a screen never waits on a long backlog; the next visit continues. */
const PURGE_BATCH = 25;

const toParticipantsJson = (list: HoursParticipantInput[] | undefined) =>
  list?.length ? (list as unknown as Json) : undefined;

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
  /**
   * The RPCs return the bare row; tags and evidence live in their own tables. Re-reads the entries so the
   * caller gets the complete shape. Best effort: if the re-read fails the write already happened, so the
   * RPC row (with empty lists) is returned instead of an error.
   */
  async function withChildren(rows: Tables<"time_entries">[]): Promise<TimeEntry[]> {
    const ids = rows.map((row) => row.id);
    try {
      const result = await client
        .from("time_entries")
        .select(TIME_ENTRY_SELECT)
        .in("id", ids);
      const fresh = new Map(
        (Array.isArray(result.data) ? result.data : []).map((row) => [row.id, row]),
      );
      return rows.map((row) => mapTimeEntry(fresh.get(row.id) ?? row));
    } catch {
      return rows.map((row) => mapTimeEntry(row));
    }
  }
  const withChild = async (row: Tables<"time_entries">) => (await withChildren([row]))[0];

  async function evidencePath(id: string) {
    const result = await client
      .from("time_entry_evidence")
      .select("path,purged_at")
      .eq("id", id)
      .maybeSingle();
    if (result.error) throw toServiceError(result.error);
    const row = result.data;
    if (!row) throw new Error("El archivo ya no está disponible.");
    if (row.purged_at)
      throw new Error("El archivo ya fue eliminado para liberar espacio.");
    return row.path;
  }

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
        withChild(
          unwrap(
            await client.rpc("submit_hours_drafts", {
              p_items: input.items as unknown as Json,
              p_date: input.date,
              p_description: input.description,
              p_participants: toParticipantsJson(input.participants),
            }),
          ),
        ),
      ),
    async listEntries(filter = {}) {
      // Las sesiones de reloj en borrador no cuentan en el historial; RLS decide de quién se ven.
      let query = client
        .from("time_entries")
        .select(TIME_ENTRY_SELECT)
        .eq("draft", false);
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
      return withChild(
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
            p_participants: toParticipantsJson(input.participants),
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
      return withChild(unwrap(await client.rpc("update_hours", { p_id: id, p_patch })));
    },
    async void(id, reason) {
      return withChild(
        unwrap(await client.rpc("void_hours", { p_id: id, p_reason: reason })),
      );
    },
    async validate(entryIds) {
      const rows = unwrap(
        await client.rpc("validate_hours", { p_ids: [...new Set(entryIds)] }),
      );
      return withChildren(rows);
    },
    async requestClarification(id, note) {
      return withChild(
        unwrap(await client.rpc("request_hours_clarification", { p_id: id, p_note: note })),
      );
    },
    async setParticipants(entryId, participants) {
      return withChild(
        unwrap(
          await client.rpc("set_hours_participants", {
            p_entry: entryId,
            p_participants: participants as unknown as Json,
          }),
        ),
      );
    },
    async addEvidence(entryId, file) {
      // Validate before touching the network: type, size (10 MiB) and that the data URL is sound.
      const blob = decodeAttachment(file);
      validateEvidenceFile({ name: file.name, type: file.type, size: blob.size });
      const id = crypto.randomUUID();
      const path = `${entryId}/${id}/${safeFilename(file.name)}`;
      const upload = await client.storage.from(EVIDENCE_BUCKET).upload(path, blob, {
        contentType: file.type,
        upsert: false,
        cacheControl: STORAGE_CACHE_CONTROL,
      });
      if (upload.error) throw toServiceError(upload.error);
      const inserted = await client
        .from("time_entry_evidence")
        .insert({
          id,
          entry_id: entryId,
          path,
          name: file.name.trim(),
          mime: file.type,
          size: blob.size,
        })
        .select()
        .single();
      if (inserted.error || !inserted.data) {
        // No row means nobody will ever clean the object: remove it now.
        await removeChatObject(client, EVIDENCE_BUCKET, path);
        throw toServiceError(inserted.error ?? new Error("El servidor no devolvió datos"));
      }
      return mapEvidence(inserted.data);
    },
    async removeEvidence(evidenceId) {
      const path = await evidencePath(evidenceId);
      // The object goes first (Storage API); the row only deletes once the object is gone.
      const removed = await client.storage.from(EVIDENCE_BUCKET).remove([path]);
      if (removed.error) throw toServiceError(removed.error);
      unwrap(
        await client.from("time_entry_evidence").delete().eq("id", evidenceId).select("id"),
      );
    },
    async getEvidenceUrl(evidenceId) {
      const path = await evidencePath(evidenceId);
      const signed = await client.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(path, EVIDENCE_SIGN_TTL_SECONDS);
      if (signed.error) throw toServiceError(signed.error);
      return signed.data.signedUrl;
    },
    async purgeExpiredEvidence() {
      try {
        const due = unwrap(
          await client
            .from("time_entry_evidence")
            .select("id,path")
            .is("purged_at", null)
            .not("purge_after", "is", null)
            .lte("purge_after", new Date().toISOString())
            .limit(PURGE_BATCH),
        );
        let removed = 0;
        for (const row of due) {
          try {
            // Storage API first (an SQL delete would orphan the file); the server only records the purge
            // once the object no longer exists, so a refused removal just retries on the next visit.
            const gone = await client.storage.from(EVIDENCE_BUCKET).remove([row.path]);
            if (gone.error) continue;
            const marked = await client
              .from("time_entry_evidence")
              .update({ purged_at: new Date().toISOString() })
              .eq("id", row.id)
              .is("purged_at", null);
            if (!marked.error) removed += 1;
          } catch {
            /* Best effort: the file stays and the next visit retries. */
          }
        }
        return removed;
      } catch {
        return 0;
      }
    },
  };
}
