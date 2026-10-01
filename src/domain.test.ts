import { describe, expect, it } from "vitest";
import {
  elapsed,
  expenseInput,
  hourInput,
  load,
  pauseTimer,
  persist,
  projectInput,
  seed,
  sprintInput,
  STORAGE_KEY,
  taskInput,
  totals,
} from "./domain";

describe("validación de registros", () => {
  it("rechaza nombres vacíos, fechas inexistentes e importes inválidos", () => {
    expect(
      projectInput.safeParse({ name: " ", description: "", status: "Activo" })
        .success,
    ).toBe(false);
    const input = {
      projectId: "p1",
      date: "2026-02-30",
      description: "Diseño",
      minutes: 20,
    };
    expect(hourInput.safeParse(input).success).toBe(false);
    expect(
      hourInput.safeParse({ ...input, date: "2026-09-30", minutes: 0 }).success,
    ).toBe(false);
    expect(
      expenseInput.safeParse({
        projectId: "p1",
        date: "2026-09-30",
        category: "Software",
        description: "Licencia",
        amount: -1,
      }).success,
    ).toBe(false);
    expect(
      sprintInput.safeParse({
        name: "Sprint",
        start: "2026-10-10",
        end: "2026-10-01",
      }).success,
    ).toBe(false);
    expect(
      taskInput.safeParse({ title: "Tarea", status: "Desconocido" }).success,
    ).toBe(false);
  });
});
describe("totales y tareas", () => {
  it("deriva los totales y actualiza el progreso con un cambio de estado", () => {
    const state = seed();
    expect(totals(state)).toEqual({
      tasks: 7,
      done: 2,
      minutes: 480,
      expenses: 154.9,
    });
    state.tasks[1].status = "Completada";
    expect(totals(state, "p1")).toEqual({
      tasks: 3,
      done: 2,
      minutes: 240,
      expenses: 89.9,
    });
  });
  it("suma moneda sin artefactos de coma flotante", () => {
    const state = seed();
    state.expenses[0].amount = 0.1;
    state.expenses[1].amount = 0.2;
    expect(totals(state).expenses).toBe(0.3);
  });
});
describe("persistencia", () => {
  it("restaura los datos y el temporizador tras recargar", () => {
    const state = seed();
    state.timer = {
      projectId: "p1",
      description: "Diseño",
      startedAt: 1000,
      accumulatedMs: 2000,
    };
    let saved = "";
    expect(
      persist(
        {
          setItem: (_key, value) => {
            saved = value;
          },
        },
        state,
      ),
    ).toBe(true);
    const restored = load({
      getItem: (key) => (key === STORAGE_KEY ? saved : null),
    });
    expect(restored.state).toEqual(state);
    expect(elapsed(restored.state.timer!, 5000)).toBe(6000);
  });
  it("recupera ejemplos con JSON roto, versión desconocida o referencias inválidas", () => {
    for (const raw of [
      "{",
      '{"version":2}',
      JSON.stringify({
        ...seed(),
        timer: {
          projectId: "missing",
          startedAt: null,
          accumulatedMs: 0,
          description: "",
        },
      }),
    ]) {
      const result = load({ getItem: () => raw });
      expect(result.state.projects.length).toBe(3);
      expect(result.warning).not.toBe("");
    }
  });
  it("permite una sesión cuando el almacenamiento está bloqueado", () => {
    expect(
      load({
        getItem: () => {
          throw new Error("blocked");
        },
      }).warning,
    ).not.toBe("");
    expect(
      persist(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        seed(),
      ),
    ).toBe(false);
  });
});
describe("temporizador", () => {
  it("pausa y continúa sin duplicar ni perder el tiempo acumulado", () => {
    const timer = {
      projectId: "p1",
      description: "Diseño",
      startedAt: 1000,
      accumulatedMs: 0,
    };
    const paused = pauseTimer(timer, 61000);
    expect(elapsed(paused, 121000)).toBe(60000);
    const resumed = { ...paused, startedAt: 121000 };
    expect(elapsed(resumed, 181000)).toBe(120000);
    expect(pauseTimer(resumed, 181000).accumulatedMs).toBe(120000);
  });
  it("no añade tiempo negativo si cambia el reloj del sistema", () => {
    expect(
      elapsed(
        {
          projectId: "p1",
          description: "",
          startedAt: 5000,
          accumulatedMs: 1000,
        },
        3000,
      ),
    ).toBe(1000);
  });
});
