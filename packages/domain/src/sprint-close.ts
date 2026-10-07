import type {
  Id,
  SprintCloseEntry,
  SprintPartnerReport,
  Task,
  TimeEntry,
} from "./types";

/** Reglas puras del cierre de sprint: reporte de entrega y horas que se pueden validar. */

export function sprintTaskIds(
  sprintId: Id,
  tasks: readonly Pick<Task, "id" | "sprintId">[],
): Set<Id> {
  return new Set(tasks.filter((t) => t.sprintId === sprintId).map((t) => t.id));
}

/** Registro finalizado y vigente (no borrador, no anulado, con horas). */
function isFinished(
  entry: Pick<TimeEntry, "draft" | "voidedAt" | "endedAt" | "hours">,
): boolean {
  return !entry.draft && !entry.voidedAt && entry.endedAt !== null && entry.hours > 0;
}

/**
 * Horas de un registro que caen en tareas del sprint: todas si su tarea es del sprint; si es un
 * registro agrupado, solo las asignaciones de tareas del sprint.
 */
export function entryHoursInSprint(
  entry: Pick<TimeEntry, "taskId" | "hours" | "allocations">,
  taskIds: ReadonlySet<Id>,
): number {
  if (entry.taskId && taskIds.has(entry.taskId)) return entry.hours;
  if (!entry.allocations?.length) return 0;
  const sum = entry.allocations
    .filter((a) => taskIds.has(a.taskId))
    .reduce((n, a) => n + a.hours, 0);
  return Math.round(sum * 100) / 100;
}

/** Comprometido vs entregado y estimado vs registrado por persona (`null` = sin responsable). */
export function buildPartnerReport(
  sprintId: Id,
  tasks: readonly Task[],
  entries: readonly TimeEntry[],
): SprintPartnerReport[] {
  const ids = sprintTaskIds(sprintId, tasks);
  const rows = new Map<Id | null, SprintPartnerReport>();
  const row = (userId: Id | null) => {
    let r = rows.get(userId);
    if (!r) {
      r = { userId, committed: 0, delivered: 0, estimatedHours: 0, loggedHours: 0 };
      rows.set(userId, r);
    }
    return r;
  };
  for (const task of tasks) {
    if (task.sprintId !== sprintId) continue;
    const r = row(task.assigneeId);
    r.committed += 1;
    if (task.status === "done") r.delivered += 1;
    r.estimatedHours += task.estimateHours ?? 0;
  }
  for (const entry of entries) {
    if (!isFinished(entry)) continue;
    const hours = entryHoursInSprint(entry, ids);
    if (hours > 0) row(entry.userId).loggedHours += hours;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...rows.values()]
    .map((r) => ({
      ...r,
      estimatedHours: round(r.estimatedHours),
      loggedHours: round(r.loggedHours),
    }))
    .sort((a, b) =>
      a.userId === b.userId
        ? 0
        : a.userId === null
          ? 1
          : b.userId === null
            ? -1
            : a.userId.localeCompare(b.userId),
    );
}

function toCloseEntry(entry: TimeEntry, hoursInSprint: number): SprintCloseEntry {
  return {
    id: entry.id,
    userId: entry.userId,
    description: entry.description ?? "",
    startedAt: entry.startedAt,
    hoursInSprint,
    participantIds: (entry.participants ?? []).map((p) => p.userId),
    clarificationRequested: Boolean(entry.reviewNote),
  };
}

function isPending(entry: TimeEntry): boolean {
  return isFinished(entry) && !entry.validated && !entry.paid;
}

/** Horas del sprint que siguen pendientes: finalizadas, vigentes, sin validar ni pagar. */
export function pendingCloseEntries(
  entries: readonly TimeEntry[],
  taskIds: ReadonlySet<Id>,
): SprintCloseEntry[] {
  const out: SprintCloseEntry[] = [];
  for (const entry of entries) {
    if (!isPending(entry)) continue;
    const hoursInSprint = entryHoursInSprint(entry, taskIds);
    if (hoursInSprint > 0) out.push(toCloseEntry(entry, hoursInSprint));
  }
  return out;
}

/**
 * Sprint cerrado: sus tareas pendientes ya salieron del sprint, así que se parte de los ids que
 * quedaron pendientes al cerrar y se conservan los que lo siguen estando.
 */
export function stillPendingAfterClose(
  entries: readonly TimeEntry[],
  pendingIds: readonly Id[],
): SprintCloseEntry[] {
  const wanted = new Set(pendingIds);
  return entries
    .filter((e) => wanted.has(e.id) && isPending(e))
    .map((e) => toCloseEntry(e, e.hours));
}

export type CloseEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/** Sin autoaprobación: nadie valida lo propio ni lo que lo etiqueta. */
export function closeEligibility(
  entry: Pick<SprintCloseEntry, "userId" | "participantIds">,
  validatorId: Id,
): CloseEligibility {
  if (entry.userId === validatorId)
    return { eligible: false, reason: "Son tus propias horas" };
  if (entry.participantIds.includes(validatorId))
    return { eligible: false, reason: "Estás etiquetado en este registro" };
  return { eligible: true };
}

export function eligibleEntryIds(
  entries: readonly SprintCloseEntry[],
  validatorId: Id,
): Id[] {
  return entries
    .filter((e) => closeEligibility(e, validatorId).eligible)
    .map((e) => e.id);
}
