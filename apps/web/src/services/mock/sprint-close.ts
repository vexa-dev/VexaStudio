import {
  buildPartnerReport,
  pendingCloseEntries,
  sprintTaskIds,
  stillPendingAfterClose,
  entryHoursInSprint,
} from "@vexa/domain/sprint-close";
import { taskEventType } from "@vexa/domain/audit";
import type {
  Id,
  Profile,
  Sprint,
  SprintCloseReport,
  TimeEntry,
} from "@vexa/domain/types";
import { recordAudit } from "./audit";
import { getDb, save } from "./db";
import { assertNotTagged, retainEvidence } from "./hours-extras";

/**
 * Cierre de sprint en el mock: mismas reglas y mismo todo-o-nada que `close_sprint` en SQL.
 * Primero se valida todo; solo entonces se muta. Los eventos de actividad son los que ya existen
 * (hours.approved por cada hora y la tarea al backlog); el cierre en sí no tiene tipo propio todavía.
 */

export const SPRINT_LOCK_MESSAGE =
  "Este registro quedó bloqueado por el cierre de sprint";

function findSprint(id: Id): Sprint {
  const sprint = getDb().sprints.find((s) => s.id === id);
  if (!sprint) throw new Error("El sprint no existe");
  return sprint;
}

/** Reporte de entrega y horas pendientes; en un sprint cerrado, el guardado al cerrar. */
export function sprintCloseReport(sprintId: Id): SprintCloseReport {
  const db = getDb();
  const sprint = findSprint(sprintId);
  if (sprint.status === "closed") {
    return {
      sprint,
      partners: sprint.deliveryReport ?? [],
      pendingEntries: stillPendingAfterClose(
        db.timeEntries,
        sprint.closePendingEntryIds ?? [],
      ),
    };
  }
  const taskIds = sprintTaskIds(sprintId, db.tasks);
  return {
    sprint,
    partners: buildPartnerReport(sprintId, db.tasks, db.timeEntries),
    pendingEntries: pendingCloseEntries(db.timeEntries, taskIds),
  };
}

export function closeSprint(
  user: Profile,
  sprintId: Id,
  entryIds: Id[],
): Sprint {
  if (user.role !== "admin")
    throw new Error("Solo un administrador puede cerrar un sprint");
  const db = getDb();
  const sprint = findSprint(sprintId);
  if (sprint.status !== "active")
    throw new Error("Solo se puede cerrar un sprint activo");
  const taskIds = sprintTaskIds(sprintId, db.tasks);

  // 1. Validar todo antes de tocar nada (todo o nada).
  const entries: TimeEntry[] = [...new Set(entryIds)].map((id) => {
    const entry = db.timeEntries.find((e) => e.id === id);
    if (
      !entry ||
      entry.draft ||
      entry.voidedAt ||
      !entry.endedAt ||
      entry.hours <= 0
    )
      throw new Error("Solo se validan registros finalizados y vigentes");
    if (entryHoursInSprint(entry, taskIds) <= 0)
      throw new Error("El registro no pertenece a este sprint");
    if (entry.paid) throw new Error("El registro ya está pagado");
    if (entry.validated) throw new Error("El registro ya está aprobado");
    if (entry.userId === user.id)
      throw new Error("No puedes aprobar tus propias horas");
    assertNotTagged(entry, user.id);
    return entry;
  });

  // 2. Reporte de entrega, antes de mover las tareas.
  const partners = buildPartnerReport(sprintId, db.tasks, db.timeEntries);

  // 3. Validar y bloquear las horas elegidas.
  const now = new Date().toISOString();
  for (const entry of entries) {
    const before = { ...entry };
    Object.assign(entry, {
      validated: true,
      validatedAt: now,
      validatedBy: user.id,
      reviewNote: null,
      reviewedBy: user.id,
      lockedBySprintId: sprintId,
    });
    retainEvidence(entry);
    recordAudit({
      eventType: "hours.approved",
      table: "time_entries",
      actorId: user.id,
      before,
      after: entry,
    });
  }

  // 4. Lo pendiente que no se validó sigue pendiente; lo no terminado vuelve al backlog.
  const pendingEntryIds = pendingCloseEntries(db.timeEntries, taskIds).map(
    (e) => e.id,
  );
  for (const task of db.tasks) {
    if (task.sprintId !== sprintId || task.status === "done") continue;
    const before = { ...task };
    task.sprintId = null;
    recordAudit({
      eventType: taskEventType(before, task),
      table: "tasks",
      actorId: user.id,
      before,
      after: task,
    });
  }

  Object.assign(sprint, {
    status: "closed",
    closedAt: now,
    closedById: user.id,
    deliveryReport: partners,
    closePendingEntryIds: pendingEntryIds,
  } satisfies Partial<Sprint>);
  save();
  return sprint;
}
