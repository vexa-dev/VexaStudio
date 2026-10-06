import { describe, expect, it } from "vitest";
import type { Project, Task, TimeEntry } from "@vexa/domain/types";
import { resolveWorkingNow } from "./working-now";

const projects = [
  { id: "p1", name: "Vexa Studio" },
  { id: "p2", name: "Fivuza" },
] as Project[];
const tasks = [
  { id: "t1", title: "Definir alcance", projectId: "p1" },
  { id: "t2", title: "Sin proyecto", projectId: null },
] as Task[];
const entry = (patch: Partial<TimeEntry>): TimeEntry =>
  ({
    id: "e1",
    userId: "u1",
    taskId: null,
    endedAt: null,
    voidedAt: null,
    ...patch,
  }) as TimeEntry;

describe("resolveWorkingNow", () => {
  it("usa el reloj con tarea y proyecto", () => {
    expect(
      resolveWorkingNow({
        running: entry({ taskId: "t1" }),
        manualProjectId: "p2",
        tasks,
        projects,
      }),
    ).toEqual({
      source: "timer",
      projectName: "Vexa Studio",
      taskTitle: "Definir alcance",
    });
  });

  it("usa solo el proyecto cuando el reloj no tiene tarea", () => {
    expect(
      resolveWorkingNow({
        running: entry({ projectId: "p2", description: "Reunión" }),
        manualProjectId: null,
        tasks,
        projects,
      }),
    ).toEqual({ source: "timer", projectName: "Fivuza", taskTitle: null });
  });

  it("cae al proyecto manual si el reloj está en pausa", () => {
    expect(
      resolveWorkingNow({
        running: entry({ taskId: "t1", timerState: "paused" }),
        manualProjectId: "p2",
        tasks,
        projects,
      }),
    ).toEqual({ source: "manual", projectName: "Fivuza", taskTitle: null });
  });

  it("ignora entradas terminadas o anuladas", () => {
    const base = { manualProjectId: "p1", tasks, projects };
    const manual = {
      source: "manual",
      projectName: "Vexa Studio",
      taskTitle: null,
    };
    expect(
      resolveWorkingNow({
        ...base,
        running: entry({ taskId: "t1", endedAt: "2026-10-05T10:00:00.000Z" }),
      }),
    ).toEqual(manual);
    expect(
      resolveWorkingNow({
        ...base,
        running: entry({ taskId: "t1", voidedAt: "2026-10-05T10:00:00.000Z" }),
      }),
    ).toEqual(manual);
  });

  it("cae al manual si el reloj no resuelve proyecto ni tarea", () => {
    expect(
      resolveWorkingNow({
        running: entry({ taskId: "missing" }),
        manualProjectId: "p2",
        tasks,
        projects,
      }),
    ).toEqual({ source: "manual", projectName: "Fivuza", taskTitle: null });
  });

  it("muestra solo la tarea cuando no tiene proyecto", () => {
    expect(
      resolveWorkingNow({
        running: entry({ taskId: "t2" }),
        manualProjectId: null,
        tasks,
        projects,
      }),
    ).toEqual({
      source: "timer",
      projectName: null,
      taskTitle: "Sin proyecto",
    });
  });

  it("devuelve null con un proyecto manual desconocido o sin datos", () => {
    expect(
      resolveWorkingNow({
        running: null,
        manualProjectId: "zzz",
        tasks,
        projects,
      }),
    ).toBeNull();
    expect(
      resolveWorkingNow({
        running: null,
        manualProjectId: null,
        tasks,
        projects,
      }),
    ).toBeNull();
  });
});
