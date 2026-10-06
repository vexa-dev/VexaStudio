import { normalizeParticipants } from "@vexa/domain/hours-credit";
import {
  EVIDENCE_MAX_FILES,
  evidencePurgeAt,
  isEvidenceDue,
  validateEvidenceFile,
} from "@vexa/domain/hours-evidence";
import { canEditEntry } from "@vexa/domain/rules";
import type {
  HoursEvidence,
  HoursParticipant,
  Id,
  Profile,
  TimeEntry,
} from "@vexa/domain/types";
import type { HoursParticipantInput, TimeService } from "@vexa/services";
import { recordAudit, scoped } from "./audit";
import { getDb, getSessionUserId, save } from "./db";
import { delay } from "./utils";

/**
 * Etiquetas con porcentaje y evidencia de las horas (mock). Aplica las mismas reglas que las guardas SQL
 * de `20261008000100_horas_etiquetas_evidencias.sql`: solo el dueño cambia etiquetas y archivos mientras el
 * registro sea editable, quien está etiquetado no revisa, y los archivos se conservan 7 días tras validar.
 */

/** Tope por archivo en el mock: los datos viven en localStorage (en Supabase son 10 MiB). */
export const MOCK_EVIDENCE_MAX_BYTES = 3 * 1024 * 1024;
const DATA_URL = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/;

function sessionUser(): Profile {
  const user = getDb().profiles.find(
    (p) => p.id === getSessionUserId() && p.active,
  );
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

/** Valida las etiquetas de la entrada (mismos mensajes que SQL) y devuelve la lista completa. */
export function buildParticipants(
  ownerId: Id,
  input: HoursParticipantInput[] | undefined,
): HoursParticipant[] {
  const profiles = getDb().profiles;
  return normalizeParticipants(input, ownerId, (id) =>
    profiles.some((p) => p.id === id && p.active),
  );
}

/** Quien aparece etiquetado no aprueba ni pide aclaración (se suma a la regla de autoaprobación). */
export function assertNotTagged(entry: TimeEntry, userId: Id) {
  if (entry.participants?.some((p) => p.userId === userId))
    throw new Error("No puedes aprobar horas en las que estás etiquetado");
}

/** Cambiar etiquetas o evidencia de un registro aprobado lo devuelve a pendiente y retira sus puntos. */
function resetApproval(entry: TimeEntry) {
  if (!entry.validated) return;
  entry.validated = false;
  entry.validatedAt = null;
  entry.validatedBy = null;
  entry.reviewedBy = null;
  clearRetention(entry);
}

/** Validar: los archivos vigentes se conservan 7 días. */
export function retainEvidence(entry: TimeEntry, now = new Date()) {
  for (const file of entry.evidence ?? [])
    if (!file.purged) file.purgeAt = evidencePurgeAt(now);
}

/** Revertir la validación: se limpia la fecha de retiro. */
export function clearRetention(entry: TimeEntry) {
  for (const file of entry.evidence ?? [])
    if (!file.purged) file.purgeAt = null;
}

/** Anular: los archivos ya no sirven a nadie y vencen de inmediato. */
export function releaseEvidence(entry: TimeEntry, now = new Date()) {
  for (const file of entry.evidence ?? [])
    if (!file.purged) file.purgeAt = now.toISOString();
}

function ownEditableEntry(id: Id, user: Profile): TimeEntry {
  const entry = getDb().timeEntries.find((e) => e.id === id);
  if (!entry) throw new Error("El registro no existe");
  if (entry.userId !== user.id)
    throw new Error("Solo puedes modificar tus propios registros");
  if (entry.draft || entry.endedAt === null)
    throw new Error("Confirma el registro antes de etiquetar a otras personas.");
  if (!canEditEntry(entry, new Date(), getDb().settings))
    throw new Error(
      "Este registro ya no se puede editar: pasaron los días permitidos o está pagado/anulado",
    );
  return entry;
}

/** El registro y el archivo si la persona los puede ver (dueño, etiquetada, socios y admin). */
function visibleEvidence(id: Id, user: Profile) {
  for (const entry of getDb().timeEntries) {
    const evidence = entry.evidence?.find((f) => f.id === id);
    if (!evidence) continue;
    const sees =
      entry.userId === user.id ||
      (!entry.draft &&
        (user.role !== "collaborator" ||
          entry.participants?.some((p) => p.userId === user.id)));
    if (!sees) break;
    return { entry, evidence };
  }
  throw new Error("El archivo ya no está disponible.");
}

function dataUrlSize(data: string): number {
  const match = DATA_URL.exec(data);
  if (!match) throw new Error("El archivo adjunto no es válido.");
  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

const hoursExtras: Pick<
  TimeService,
  | "setParticipants"
  | "addEvidence"
  | "removeEvidence"
  | "getEvidenceUrl"
  | "purgeExpiredEvidence"
> = scoped({
  async setParticipants(entryId, participants) {
    const user = sessionUser();
    const entry = ownEditableEntry(entryId, user);
    const next = buildParticipants(user.id, participants);
    const before = structuredClone(entry);
    entry.participants = next;
    resetApproval(entry);
    recordAudit({
      eventType: "hours.edited",
      table: "time_entries",
      actorId: user.id,
      before,
      after: entry,
    });
    save();
    return delay(entry);
  },
  async addEvidence(entryId, file) {
    const user = sessionUser();
    const entry = ownEditableEntry(entryId, user);
    const size = dataUrlSize(file.data);
    if (DATA_URL.exec(file.data)?.[1] !== file.type)
      throw new Error("El archivo adjunto no es válido.");
    validateEvidenceFile(
      { name: file.name, type: file.type, size },
      MOCK_EVIDENCE_MAX_BYTES,
    );
    if ((entry.evidence ?? []).filter((f) => !f.purged).length >= EVIDENCE_MAX_FILES)
      throw new Error("Cada registro admite hasta 5 archivos.");
    const db = getDb();
    const before = structuredClone(entry);
    const evidence: HoursEvidence = {
      id: `ev-${crypto.randomUUID()}`,
      name: file.name.trim(),
      mime: file.type,
      size,
      createdAt: new Date().toISOString(),
      purgeAt: null,
      purged: false,
    };
    (entry.evidence ??= []).push(evidence);
    (db.evidenceFiles ??= {})[evidence.id] = file.data;
    resetApproval(entry);
    recordAudit({
      eventType: "hours.edited",
      table: "time_entries",
      actorId: user.id,
      before,
      after: entry,
    });
    save();
    return delay(evidence);
  },
  async removeEvidence(evidenceId) {
    const user = sessionUser();
    const { entry, evidence } = visibleEvidence(evidenceId, user);
    ownEditableEntry(entry.id, user);
    if (evidence.purged)
      throw new Error("El archivo ya fue eliminado para liberar espacio.");
    const before = structuredClone(entry);
    entry.evidence = (entry.evidence ?? []).filter((f) => f.id !== evidenceId);
    delete getDb().evidenceFiles?.[evidenceId];
    resetApproval(entry);
    recordAudit({
      eventType: "hours.edited",
      table: "time_entries",
      actorId: user.id,
      before,
      after: entry,
    });
    save();
    return delay(undefined);
  },
  async getEvidenceUrl(evidenceId) {
    const { evidence } = visibleEvidence(evidenceId, sessionUser());
    const data = getDb().evidenceFiles?.[evidenceId];
    if (evidence.purged || !data)
      throw new Error("El archivo ya fue eliminado para liberar espacio.");
    return delay(data);
  },
  async purgeExpiredEvidence() {
    try {
      const user = sessionUser();
      const db = getDb();
      const now = new Date();
      let removed = 0;
      for (const entry of db.timeEntries) {
        for (const file of entry.evidence ?? []) {
          if (!isEvidenceDue(file, now)) continue;
          try {
            visibleEvidence(file.id, user);
          } catch {
            continue;
          }
          const before = structuredClone(entry);
          delete db.evidenceFiles?.[file.id];
          file.purged = true;
          removed += 1;
          recordAudit({
            eventType: "hours.edited",
            table: "time_entries",
            actorId: user.id,
            before,
            after: entry,
          });
        }
      }
      if (removed) save();
      return removed;
    } catch {
      return 0;
    }
  },
});

export const hoursExtrasService = hoursExtras;
