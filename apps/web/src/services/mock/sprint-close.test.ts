import { beforeEach, describe, expect, it } from "vitest";
import type { Task, TimeEntry } from "@vexa/domain/types";
import { getDb, resetMock, setSessionUserId } from "./db";
import { sprints, time } from "./work";

const JHONY = "u-jhony";
const ROBER = "u-rober";
const DIEGO = "u-diego";
const JOSE = "u-jose";
const S1 = "sc-1";
const S2 = "sc-2";

const task = (over: Partial<Task>): Task => ({
  id: "x",
  sprintId: S1,
  projectId: "p-vexa",
  title: "Tarea",
  status: "todo",
  assigneeId: ROBER,
  estimateHours: 2,
  hoursPrepared: true,
  link: null,
  ...over,
});
const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: "x",
  userId: ROBER,
  taskId: "sc-t1",
  startedAt: "2026-10-02T15:00:00.000Z",
  endedAt: "2026-10-02T17:00:00.000Z",
  hours: 2,
  paid: false,
  validated: false,
  validatedAt: null,
  createdAt: new Date().toISOString(),
  voidedAt: null,
  voidReason: null,
  description: "Trabajo de prueba",
  participants: [],
  evidence: [],
  ...over,
});

beforeEach(() => {
  resetMock();
  const db = getDb();
  const projectId = db.projects[0].id;
  db.sprints.push(
    { id: S1, projectId, startDate: "2026-10-01", endDate: "2026-10-14", goal: "A cerrar", status: "active" },
    { id: S2, projectId, startDate: "2026-10-15", endDate: "2026-10-28", goal: "Siguiente", status: "planned" },
  );
  db.tasks.push(
    task({ id: "sc-t1", projectId, status: "done", assigneeId: ROBER, estimateHours: 4 }),
    task({ id: "sc-t2", projectId, status: "in_progress", assigneeId: JOSE, estimateHours: 3 }),
    task({ id: "sc-t3", projectId, sprintId: S2, assigneeId: ROBER }),
  );
  db.timeEntries.push(
    entry({ id: "sc-e1", userId: ROBER, taskId: "sc-t1" }),
    entry({ id: "sc-e2", userId: JOSE, taskId: "sc-t2", hours: 1 }),
    entry({ id: "sc-e3", userId: DIEGO, taskId: "sc-t1", participants: [{ userId: JHONY, sharePercent: 50 }] }),
    entry({ id: "sc-e4", userId: JHONY, taskId: "sc-t1" }),
    entry({ id: "sc-e5", userId: ROBER, taskId: "sc-t3" }),
  );
  setSessionUserId(JHONY);
});

const entryOf = (id: string) => getDb().timeEntries.find((e) => e.id === id)!;
const taskOf = (id: string) => getDb().tasks.find((t) => t.id === id)!;

describe("cierre de sprint (mock)", () => {
  it("solo el admin cierra", async () => {
    setSessionUserId(ROBER);
    await expect(sprints.close(S1, [])).rejects.toThrow("Solo un administrador puede cerrar un sprint");
    expect(getDb().sprints.find((s) => s.id === S1)?.status).toBe("active");
  });

  it("valida en bloque, bloquea las horas, manda lo pendiente al backlog y cierra", async () => {
    const closed = await sprints.close(S1, ["sc-e1", "sc-e2"]);
    expect(closed).toMatchObject({ status: "closed", closedById: JHONY });
    for (const id of ["sc-e1", "sc-e2"]) {
      expect(entryOf(id)).toMatchObject({ validated: true, validatedBy: JHONY, lockedBySprintId: S1 });
    }
    expect(entryOf("sc-e3").validated).toBe(false);
    expect(entryOf("sc-e3").lockedBySprintId).toBeUndefined();
    expect(taskOf("sc-t2").sprintId).toBeNull();
    expect(taskOf("sc-t1").sprintId).toBe(S1);
    expect(taskOf("sc-t3").sprintId).toBe(S2);
    expect(getDb().auditLog.filter((a) => a.eventType === "hours.approved" && ["sc-e1", "sc-e2"].includes(a.entity.id))).toHaveLength(2);
  });

  it("guarda el reporte de entrega y lista lo que quedó pendiente", async () => {
    await sprints.close(S1, ["sc-e1"]);
    const report = await sprints.getCloseReport!(S1);
    expect(report.sprint.status).toBe("closed");
    expect(report.partners.find((p) => p.userId === ROBER)).toMatchObject({
      committed: 1,
      delivered: 1,
      estimatedHours: 4,
      loggedHours: 2,
    });
    expect(report.partners.find((p) => p.userId === JOSE)).toMatchObject({ committed: 1, delivered: 0 });
    expect(report.pendingEntries.map((e) => e.id).sort()).toEqual(["sc-e2", "sc-e3", "sc-e4"]);
  });

  it("el reporte de un sprint abierto sale de los datos vivos", async () => {
    const report = await sprints.getCloseReport!(S1);
    expect(report.sprint.status).toBe("active");
    expect(report.pendingEntries.map((e) => e.id).sort()).toEqual(["sc-e1", "sc-e2", "sc-e3", "sc-e4"]);
  });

  it("niega horas propias, etiquetadas y de otro sprint, sin cambiar nada", async () => {
    await expect(sprints.close(S1, ["sc-e1", "sc-e4"])).rejects.toThrow("No puedes aprobar tus propias horas");
    await expect(sprints.close(S1, ["sc-e1", "sc-e3"])).rejects.toThrow("etiquetado");
    await expect(sprints.close(S1, ["sc-e1", "sc-e5"])).rejects.toThrow("El registro no pertenece a este sprint");
    await expect(sprints.close(S1, ["sc-e1", "nope"])).rejects.toThrow("finalizados y vigentes");
    expect(entryOf("sc-e1").validated).toBe(false);
    expect(getDb().sprints.find((s) => s.id === S1)?.status).toBe("active");
    expect(taskOf("sc-t2").sprintId).toBe(S1);
  });

  it("no cierra un sprint cerrado ni uno planificado", async () => {
    await sprints.close(S1, []);
    await expect(sprints.close(S1, [])).rejects.toThrow("Solo se puede cerrar un sprint activo");
    await expect(sprints.close(S2, [])).rejects.toThrow("Solo se puede cerrar un sprint activo");
  });

  it("el dueño ya no edita una hora validada en el cierre", async () => {
    await sprints.close(S1, ["sc-e1"]);
    setSessionUserId(ROBER);
    await expect(time.update("sc-e1", { description: "Cambio posterior al cierre" })).rejects.toThrow(
      "bloqueado por el cierre de sprint",
    );
  });
});
