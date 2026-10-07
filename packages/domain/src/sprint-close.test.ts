import { describe, expect, it } from "vitest";
import type { Task, TimeEntry } from "./types";
import {
  buildPartnerReport,
  closeEligibility,
  stillPendingAfterClose,
  eligibleEntryIds,
  entryHoursInSprint,
  pendingCloseEntries,
  sprintTaskIds,
} from "./sprint-close";

const task = (over: Partial<Task>): Task => ({
  id: "t1",
  sprintId: "s1",
  projectId: "p1",
  title: "Tarea",
  status: "todo",
  assigneeId: "u1",
  estimateHours: 2,
  ...over,
}) as Task;

const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: "e1",
  userId: "u1",
  taskId: "t1",
  startedAt: "2026-10-01T15:00:00.000Z",
  endedAt: "2026-10-01T17:00:00.000Z",
  hours: 2,
  paid: false,
  validated: false,
  validatedAt: null,
  createdAt: "2026-10-01T17:00:00.000Z",
  voidedAt: null,
  voidReason: null,
  ...over,
});

describe("entryHoursInSprint", () => {
  const ids = new Set(["t1", "t2"]);
  it("cuenta todas las horas si la tarea es del sprint", () => {
    expect(entryHoursInSprint(entry({}), ids)).toBe(2);
  });
  it("no cuenta registros de otra tarea ni sin tarea", () => {
    expect(entryHoursInSprint(entry({ taskId: "x" }), ids)).toBe(0);
    expect(entryHoursInSprint(entry({ taskId: null }), ids)).toBe(0);
  });
  it("suma solo las asignaciones que caen en el sprint", () => {
    const grouped = entry({
      taskId: null,
      hours: 3,
      allocations: [
        { taskId: "t1", title: "a", projectId: "p1", hours: 1 },
        { taskId: "x", title: "b", projectId: "p1", hours: 1.5 },
        { taskId: "t2", title: "c", projectId: "p1", hours: 0.5 },
      ],
    });
    expect(entryHoursInSprint(grouped, ids)).toBe(1.5);
  });
});

describe("buildPartnerReport", () => {
  const tasks = [
    task({ id: "t1", assigneeId: "u1", status: "done", estimateHours: 2 }),
    task({ id: "t2", assigneeId: "u1", status: "review", estimateHours: 3 }),
    task({ id: "t3", assigneeId: "u2", status: "done", estimateHours: null }),
    task({ id: "t4", assigneeId: null, status: "todo", estimateHours: 1 }),
    task({ id: "other", sprintId: "s2", assigneeId: "u2", status: "done" }),
  ];
  const entries = [
    entry({ id: "a", userId: "u1", taskId: "t1", hours: 2 }),
    entry({ id: "b", userId: "u2", taskId: "t2", hours: 1 }),
    entry({ id: "c", userId: "u2", taskId: "t3", hours: 4, validated: true }),
    entry({ id: "void", userId: "u1", taskId: "t1", hours: 9, voidedAt: "2026-10-02T00:00:00.000Z", voidReason: "x" }),
    entry({ id: "draft", userId: "u1", taskId: "t1", hours: 9, draft: true }),
    entry({ id: "open", userId: "u1", taskId: "t1", hours: 9, endedAt: null }),
    entry({ id: "elsewhere", userId: "u1", taskId: "other", hours: 9 }),
  ];
  const report = buildPartnerReport("s1", tasks, entries);
  const of = (id: string | null) => report.find((r) => r.userId === id);

  it("compara comprometido y entregado por persona", () => {
    expect(of("u1")).toMatchObject({ committed: 2, delivered: 1 });
    expect(of("u2")).toMatchObject({ committed: 1, delivered: 1 });
    expect(of(null)).toMatchObject({ committed: 1, delivered: 0 });
  });
  it("estimadas vs registradas, sin anuladas, borradores ni abiertas", () => {
    expect(of("u1")).toMatchObject({ estimatedHours: 5, loggedHours: 2 });
    expect(of("u2")).toMatchObject({ estimatedHours: 0, loggedHours: 5 });
  });
  it("ignora tareas de otros sprints", () => {
    expect(report.reduce((n, r) => n + r.committed, 0)).toBe(4);
  });
  it("lista a quien registró horas sin tener tareas", () => {
    const only = buildPartnerReport("s1", tasks.slice(0, 1), [
      entry({ id: "z", userId: "u9", taskId: "t1", hours: 1 }),
    ]);
    expect(only.find((r) => r.userId === "u9")).toMatchObject({ committed: 0, loggedHours: 1 });
  });
});

describe("pendingCloseEntries y elegibilidad", () => {
  const ids = sprintTaskIds("s1", [task({ id: "t1" }), task({ id: "t2", sprintId: "s2" })]);
  const entries = [
    entry({ id: "ok", userId: "u2" }),
    entry({ id: "validated", validated: true }),
    entry({ id: "paid", paid: true }),
    entry({ id: "voided", voidedAt: "2026-10-02T00:00:00.000Z", voidReason: "x" }),
    entry({ id: "draft", draft: true }),
    entry({ id: "zero", hours: 0 }),
    entry({ id: "elsewhere", taskId: "t2" }),
    entry({ id: "tag", userId: "u2", participants: [{ userId: "u3", sharePercent: 50 }], reviewNote: "Aclara esto por favor" }),
  ];
  const pending = pendingCloseEntries(entries, ids);

  it("solo lista horas pendientes, vigentes, no pagadas y del sprint", () => {
    expect(pending.map((e) => e.id)).toEqual(["ok", "tag"]);
    expect(pending[1]).toMatchObject({ participantIds: ["u3"], clarificationRequested: true, hoursInSprint: 2 });
  });
  it("niega lo propio y lo etiquetado, con motivo", () => {
    const [ok, tag] = pending;
    expect(closeEligibility(ok, "u2")).toEqual({ eligible: false, reason: "Son tus propias horas" });
    expect(closeEligibility(tag, "u3")).toEqual({
      eligible: false,
      reason: "Estás etiquetado en este registro",
    });
    expect(closeEligibility(ok, "u1")).toEqual({ eligible: true });
  });
  it("elige todo lo elegible", () => {
    expect(eligibleEntryIds(pending, "u3")).toEqual(["ok"]);
    expect(eligibleEntryIds(pending, "u1")).toEqual(["ok", "tag"]);
  });
});

describe("stillPendingAfterClose", () => {
  it("de lo que quedó pendiente al cerrar, solo lo que aún lo está", () => {
    const entries = [
      entry({ id: "a", userId: "u2" }),
      entry({ id: "b", validated: true }),
      entry({ id: "c", voidedAt: "2026-10-02T00:00:00.000Z", voidReason: "x" }),
      entry({ id: "d" }),
    ];
    const out = stillPendingAfterClose(entries, ["a", "b", "c"]);
    expect(out.map((e) => e.id)).toEqual(["a"]);
    expect(out[0]).toMatchObject({ userId: "u2", hoursInSprint: 2 });
  });
});
