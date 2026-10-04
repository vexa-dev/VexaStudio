import { beforeEach, describe, expect, it } from "vitest";
import { todayLima } from "@vexa/domain/dates";
import { getDb, resetMock, setSessionUserId } from "./db";
import { sprints, time } from "./work";

const ROBER = "u-rober";
const DIEGO = "u-diego";

beforeEach(() => {
  resetMock();
  setSessionUserId(ROBER);
  getDb().timeEntries = [];
  getDb().auditLog = [];
});

const events = () => getDb().auditLog.map((a) => a.eventType);
const last = () => getDb().auditLog.at(-1);
const manual = () =>
  time.addManual({
    taskId: null,
    date: "2026-09-01",
    startTime: "09:30",
    hours: 1.5,
    description: "Preparé la propuesta comercial",
    projectId: "p-vexa",
  });

describe("actividad de horas", () => {
  it("registrar, editar y anular dejan eventos distintos con motivo en la anulación", async () => {
    const entry = await manual();
    expect(last()).toMatchObject({
      eventType: "hours.created",
      entity: { table: "time_entries", id: entry.id, projectId: "p-vexa" },
      actorRole: "partner",
    });
    await time.update(entry.id, { hours: 2 });
    expect(last()?.eventType).toBe("hours.edited");
    expect(last()?.changes.map((c) => c.field)).toContain("hours");
    await time.void(entry.id, " Lo registré dos veces ");
    expect(last()).toMatchObject({
      eventType: "hours.voided",
      reason: "Lo registré dos veces",
    });
  });

  it("aprobar y pedir aclaración registran al revisor y su motivo", async () => {
    const entry = await manual();
    setSessionUserId(DIEGO);
    await time.requestClarification(entry.id, "Falta el enlace de evidencia");
    expect(last()).toMatchObject({
      eventType: "hours.clarification_requested",
      actorId: DIEGO,
      reason: "Falta el enlace de evidencia",
    });
    await time.validate([entry.id]);
    expect(last()).toMatchObject({
      eventType: "hours.approved",
      actorId: DIEGO,
    });
    expect(last()?.changes.map((c) => c.field)).toEqual(
      expect.arrayContaining(["validated", "validatedBy"]),
    );
  });

  it("el reloj registra inicio y fin, y confirmar un borrador registra hours.confirmed", async () => {
    await time.start("t-5");
    expect(last()?.eventType).toBe("timer.started");
    await time.stop();
    expect(last()?.eventType).toBe("timer.stopped");
    const [draft] = await time.listDrafts();
    const entry = await time.submitDrafts({
      items: [{ id: draft.id, hours: 1 }],
      date: todayLima(),
    });
    expect(last()).toMatchObject({
      eventType: "hours.confirmed",
      entity: { id: entry.id },
    });
  });

  it("iniciar un reloj con otro abierto registra la detención del anterior", async () => {
    await time.start("t-5");
    getDb().auditLog = [];
    await time.start("t-3");
    expect(events()).toEqual(
      expect.arrayContaining(["timer.stopped", "timer.started"]),
    );
  });

  it("crear un sprint deja sprint.created con su proyecto", async () => {
    setSessionUserId("u-jhony");
    const sprint = await sprints.create({
      projectId: "p-fivuza",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
      goal: "Lanzar la landing",
    });
    expect(last()).toMatchObject({
      eventType: "sprint.created",
      entity: {
        table: "sprints",
        id: sprint.id,
        projectId: "p-fivuza",
        label: "Lanzar la landing",
      },
    });
  });
});
