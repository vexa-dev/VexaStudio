import { beforeEach, describe, expect, it } from "vitest";
import { todayLima } from "@vexa/domain/dates";
import { getDb, resetMock, setSessionUserId } from "./db";
import { sprints, tasks, time } from "./work";

const ROBER = "u-rober";
const DIEGO = "u-diego";

beforeEach(() => {
  resetMock();
  setSessionUserId(ROBER);
});

const openEntries = (userId: string) =>
  getDb().timeEntries.filter(
    (e) => e.userId === userId && e.endedAt === null && !e.voidedAt,
  );

describe("temporizador", () => {
  it("iniciar uno detiene el anterior: solo queda uno abierto", async () => {
    const first = await time.start("t-5");
    const second = await time.start("t-3");
    expect(openEntries(ROBER)).toHaveLength(1);
    expect(openEntries(ROBER)[0].id).toBe(second.id);
    const closed = getDb().timeEntries.find((e) => e.id === first.id);
    expect(closed?.endedAt).not.toBeNull();
  });

  it("al iniciar, la tarea pendiente pasa a en progreso", async () => {
    setSessionUserId("u-jhony");
    await time.start("t-7"); // "Registrar gastos recurrentes", pendiente
    expect(getDb().tasks.find((t) => t.id === "t-7")?.status).toBe(
      "in_progress",
    );
  });

  it("detener sin temporizador abierto devuelve null", async () => {
    expect(await time.stop()).toBeNull();
  });

  it("el temporizador de una persona no detiene el de otra", async () => {
    await time.start("t-5");
    setSessionUserId(DIEGO);
    await time.start("t-4");
    expect(openEntries(ROBER)).toHaveLength(1);
    expect(openEntries(DIEGO)).toHaveLength(1);
  });
});

describe("registro manual", () => {
  it("crea el registro con las horas indicadas y lo deja en la auditoría", async () => {
    const entry = await time.addManual({
      taskId: "t-5",
      date: todayLima(),
      hours: 1.5,
    });
    expect(entry).toMatchObject({
      userId: ROBER,
      hours: 1.5,
      validated: false,
      paid: false,
    });
    expect(
      getDb().auditLog.some(
        (a) => a.entity.id === entry.id && a.eventType === "hours.created",
      ),
    ).toBe(true);
  });

  it("rechaza fechas futuras y horas fuera de rango", async () => {
    await expect(
      time.addManual({ taskId: "t-5", date: "2999-01-01", hours: 1 }),
    ).rejects.toThrow("futura");
    await expect(
      time.addManual({ taskId: "t-5", date: todayLima(), hours: 0 }),
    ).rejects.toThrow("entre 0 y 24");
    await expect(
      time.addManual({ taskId: "t-5", date: todayLima(), hours: 25 }),
    ).rejects.toThrow("entre 0 y 24");
  });
});

describe("edición y anulación", () => {
  it("permite editar un registro propio reciente", async () => {
    const updated = await time.update("h-u-rober-0-0", { hours: 2 });
    expect(updated.hours).toBe(2);
  });

  it("no permite editar registros de otra persona", async () => {
    await expect(time.update("h-u-diego-0-0", { hours: 2 })).rejects.toThrow(
      "propios",
    );
  });

  it("no permite editar un registro validado", async () => {
    await expect(time.update("h-u-rober-2-0", { hours: 2 })).rejects.toThrow(
      "ya no se puede editar",
    );
  });

  it("anular exige motivo y deja constancia", async () => {
    await expect(time.void("h-u-rober-0-1", " ")).rejects.toThrow("motivo");
    const voided = await time.void("h-u-rober-0-1", "Lo registré dos veces");
    expect(voided.voidedAt).not.toBeNull();
    expect(
      getDb().auditLog.some(
        (a) => a.entity.id === voided.id && a.eventType === "hours.voided",
      ),
    ).toBe(true);
  });

  it("no permite anular un registro validado", async () => {
    await expect(time.void("h-u-rober-2-0", "Prueba")).rejects.toThrow(
      "validado",
    );
  });
});

describe("tareas y sprints", () => {
  beforeEach(() => setSessionUserId("u-jhony"));
  it("crea y mueve una tarea", async () => {
    const task = await tasks.create({
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "  Probar el kanban  ",
      assigneeId: ROBER,
      estimateHours: 2,
      link: null,
    });
    expect(task).toMatchObject({ title: "Probar el kanban", status: "todo" });
    expect((await tasks.move(task.id, "review")).status).toBe("review");
  });

  it("el primer sprint de un proyecto queda activo y el siguiente planificado", async () => {
    const input = {
      projectId: "p-fivuza",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
      goal: "Lanzar la landing",
    };
    expect((await sprints.create(input)).status).toBe("active");
    expect((await sprints.create({ ...input, goal: "Siguiente" })).status).toBe(
      "planned",
    );
  });

  it("rechaza un sprint que termina antes de empezar", async () => {
    await expect(
      sprints.create({
        projectId: "p-fivuza",
        startDate: "2026-10-14",
        endDate: "2026-10-01",
        goal: "X",
      }),
    ).rejects.toThrow("anterior");
  });
});

describe("actividades y revisión de horas", () => {
  beforeEach(() => {
    getDb().timeEntries = [];
  });
  const input = () => ({
    taskId: null,
    date: "2026-09-01",
    startTime: "09:30",
    hours: 1.5,
    description: "Preparé la propuesta comercial",
    projectId: null,
  });
  it("registra actividad sin tarea con horario de Lima", async () => {
    const e = await time.addManual(input());
    expect(e.taskId).toBeNull();
    expect(e.startedAt).toBe("2026-09-01T14:30:00.000Z");
    expect(e.source).toBe("manual");
  });
  it("rechaza actividad vacía y horarios superpuestos", async () => {
    await expect(
      time.addManual({ ...input(), description: "" }),
    ).rejects.toThrow("Describe");
    await time.addManual(input());
    await expect(
      time.addManual({ ...input(), startTime: "10:00" }),
    ).rejects.toThrow("superpone");
  });
  it("otro socio aprueba y el autor no puede aprobar sus horas", async () => {
    const e = await time.addManual(input());
    await expect(time.validate([e.id])).rejects.toThrow("propias");
    setSessionUserId(DIEGO);
    const [approved] = await time.validate([e.id]);
    expect(approved.validated).toBe(true);
    expect(approved.validatedBy).toBe(DIEGO);
    expect(getDb().auditLog.filter((a) => a.entity.id === e.id)).toHaveLength(
      2,
    );
  });
  it("pide aclaración con motivo y permite corregir volviendo a revisión", async () => {
    const e = await time.addManual(input());
    setSessionUserId(DIEGO);
    await expect(time.requestClarification(e.id, "")).rejects.toThrow(
      "Explica",
    );
    await time.requestClarification(e.id, "Añade el resultado de la propuesta");
    setSessionUserId(ROBER);
    const changed = await time.update(e.id, {
      description: "Preparé tres opciones y las compartí",
    });
    expect(changed.reviewNote).toBeNull();
    expect(changed.validated).toBe(false);
  });
  it("editar una aprobación reciente reabre revisión y elimina puntos", async () => {
    const e = await time.addManual(input());
    setSessionUserId(DIEGO);
    await time.validate([e.id]);
    setSessionUserId(ROBER);
    const changed = await time.update(e.id, {
      description: "Preparé cuatro opciones comerciales",
    });
    expect(changed.validated).toBe(false);
    expect(changed.validatedBy).toBeNull();
  });
  it("colaboradores no aprueban y una solicitud mixta no se aplica parcialmente", async () => {
    const e = await time.addManual(input());
    setSessionUserId(DIEGO);
    await expect(time.validate([e.id, "missing"])).rejects.toThrow(
      "finalizados",
    );
    expect(e.validated).toBe(false);
    getDb().profiles.find((p) => p.id === DIEGO)!.role = "collaborator";
    await expect(time.validate([e.id])).rejects.toThrow("rol");
  });
});

describe("protección de horarios", () => {
  beforeEach(() => {
    getDb().timeEntries = [];
  });
  it("rechaza un horario que termina en el futuro y fechas inválidas", async () => {
    await expect(
      time.addManual({
        taskId: null,
        date: "2999-01-01",
        hours: 1,
        startTime: "09:00",
        description: "Trabajo del estudio",
      }),
    ).rejects.toThrow("futura");
    await expect(
      time.addManual({
        taskId: null,
        date: "2026-02-30",
        hours: 1,
        startTime: "09:00",
        description: "Trabajo del estudio",
      }),
    ).rejects.toThrow("Fecha no válida");
  });
  it("permite iniciar temporizador sin tarea y conserva la descripción", async () => {
    const e = await time.start(null, {
      description: "Organizar los acuerdos del equipo",
      projectId: null,
    });
    expect(e.taskId).toBeNull();
    expect(e.source).toBe("timer");
    expect(e.description).toContain("acuerdos");
    expect((await time.stop())?.endedAt).not.toBeNull();
  });
});
