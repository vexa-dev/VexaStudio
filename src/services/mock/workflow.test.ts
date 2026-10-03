import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { projects, tasks, time } from "./work";
import { timerElapsed } from "@/domain/timer";
import { monthlyActivity } from "@/features/time/analytics";
import { summarizeMonth } from "./dashboard";

const collaborator = "u-demo-collaborator";
beforeEach(() => {
  resetMock();
  setSessionUserId(collaborator);
  getDb();
});
afterEach(() => vi.useRealTimers());

describe("asignación y membresía independientes", () => {
  it("ve sus tareas de otro proyecto sin acceder a ese proyecto", async () => {
    expect((await tasks.list()).map((t) => t.id)).toContain("t-demo-external");
    expect((await projects.list()).map((p) => p.id)).toEqual(["p-vexa"]);
    await expect(projects.get("p-fivuza")).rejects.toThrow("acceso");
    await expect(tasks.list({ projectId: "p-fivuza" })).rejects.toThrow(
      "acceso",
    );
    expect(
      (await tasks.list({ projectId: "p-vexa" })).some(
        (t) => t.assigneeId !== collaborator,
      ),
    ).toBe(true);
  });
  it("mueve solo sus tareas y no puede cambiar responsables ni crear proyectos", async () => {
    await tasks.move("t-demo-independent", "in_progress");
    await expect(tasks.move("t-7", "done")).rejects.toThrow("asignadas");
    await expect(
      tasks.update("t-demo-member", { assigneeId: "u-rober" }),
    ).rejects.toThrow("administrador");
    await expect(
      projects.create({
        name: "No autorizado",
        type: "internal",
        status: "active",
      }),
    ).rejects.toThrow("administrador");
    await expect(time.start("t-7")).rejects.toThrow("asignadas");
    expect(
      (await time.listEntries()).every((e) => e.userId === collaborator),
    ).toBe(true);
  });
  it("el administrador crea tareas sin proyecto y asignar no agrega membresía", async () => {
    setSessionUserId("u-jhony");
    const project = await projects.create({
      name: "Nuevo proyecto",
      type: "client",
      status: "active",
      memberIds: [],
    });
    const task = await tasks.create({
      title: "Trabajo puntual",
      projectId: project.id,
      sprintId: null,
      assigneeId: collaborator,
      estimateHours: 1,
      link: null,
    });
    await tasks.create({
      title: "Trabajo independiente",
      projectId: null,
      sprintId: null,
      assigneeId: collaborator,
      estimateHours: null,
      link: null,
    });
    setSessionUserId(collaborator);
    expect((await tasks.list()).map((t) => t.id)).toContain(task.id);
    await expect(projects.get(project.id)).rejects.toThrow("acceso");
    setSessionUserId("u-jhony");
    await projects.update(project.id, { memberIds: [collaborator] });
    setSessionUserId(collaborator);
    expect((await projects.get(project.id))?.name).toBe("Nuevo proyecto");
  });
});

describe("terminar → borradores → un registro en revisión", () => {
  it("terminar no registra horas ni duplica el borrador al reabrir", async () => {
    await tasks.move("t-demo-member", "done");
    await tasks.move("t-demo-member", "todo");
    await tasks.move("t-demo-member", "done");
    const drafts = await time.listDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ hours: 2, measured: false });
    expect(await time.listEntries()).toHaveLength(0);
  });
  it("confirma tres tareas con 4 horas totales, permite editar y bloquea doble envío", async () => {
    for (const id of ["t-demo-member", "t-demo-external", "t-demo-independent"])
      await tasks.move(id, "done");
    const drafts = await time.listDrafts();
    const items = drafts.map((d, i) => ({ id: d.id, hours: i === 0 ? 2 : 1 }));
    const entry = await time.submitDrafts({ items, date: "2026-09-01" });
    expect(entry.hours).toBe(4);
    expect(entry.validated).toBe(false);
    expect(entry.allocations).toHaveLength(3);
    expect(await time.listEntries()).toHaveLength(1);
    expect(await time.listDrafts()).toHaveLength(0);
    await expect(
      time.submitDrafts({ items, date: "2026-09-01" }),
    ).rejects.toThrow("disponible");
    setSessionUserId("u-jhony");
    await time.validate([entry.id]);
    expect(
      (await time.listEntries()).find((e) => e.id === entry.id)?.validated,
    ).toBe(true);
  });
  it("rechaza un lote inválido sin consumir parcialmente borradores", async () => {
    await tasks.move("t-demo-independent", "done");
    const [draft] = await time.listDrafts();
    await expect(
      time.submitDrafts({
        items: [
          { id: draft.id, hours: 2 },
          { id: "invalid", hours: 1 },
        ],
        date: "2026-09-01",
      }),
    ).rejects.toThrow("disponible");
    expect(await time.listDrafts()).toHaveLength(1);
    expect(await time.listEntries()).toHaveLength(0);
  });
});

describe("reloj persistente y pausas", () => {
  it("deriva horas fuera de la página y excluye pausas del registro y gráfico", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-02T14:00:00Z"));
    const entry = await time.start("t-demo-member");
    // Simulate a closed or frozen browser using stored timestamps; no ticks required.
    const start = Date.parse(entry.startedAt);
    expect(timerElapsed(entry, start + 3 * 3600000)).toBe(3 * 3600000);
    const stored = getDb().timeEntries.find((e) => e.id === entry.id)!;
    stored.startedAt = "2026-09-01T14:00:00Z";
    stored.segmentStartedAt = "2026-09-01T14:00:00Z";
    stored.timerState = "paused";
    stored.elapsedMs = 3600000;
    stored.segments = [
      { start: "2026-09-01T14:00:00Z", end: "2026-09-01T15:00:00Z" },
    ];
    expect(timerElapsed(stored, Date.parse("2026-09-01T20:00:00Z"))).toBe(
      3600000,
    );
    const stopped = await time.stop();
    expect(stopped?.hours).toBe(1);
    expect(await time.listEntries()).toHaveLength(0);
    const [draft] = await time.listDrafts();
    expect(draft.measured).toBe(true);
    expect(monthlyActivity([stopped!], "2026-09").total).toBe(0);
    expect(
      summarizeMonth("2026-09").find((m) => m.userId === "u-jhony")?.hours,
    ).toBeGreaterThanOrEqual(0);
    vi.restoreAllMocks();
  });
  it("pause y resume son idempotentes y terminar la tarea cierra el reloj", async () => {
    await time.start("t-demo-member");
    const paused = await time.pause();
    expect(paused?.timerState).toBe("paused");
    expect((await time.pause())?.segments).toHaveLength(1);
    await time.resume();
    await time.resume();
    await tasks.move("t-demo-member", "done");
    expect(await time.getRunning()).toBeNull();
    const drafts = await time.listDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].measured).toBe(true);
  });
});
