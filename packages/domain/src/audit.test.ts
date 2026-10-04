import { describe, expect, it } from "vitest";
import {
  diffFields,
  entityLabel,
  entityProjectId,
  taskEventType,
} from "./audit";

describe("diffFields", () => {
  it("devuelve vacío cuando nada cambió", () => {
    expect(diffFields({ a: 1, b: "x" }, { b: "x", a: 1 })).toEqual([]);
  });

  it("lista solo los campos que cambiaron", () => {
    expect(diffFields({ a: 1, b: "x" }, { a: 2, b: "x" })).toEqual([
      { field: "a", from: 1, to: 2 },
    ]);
  });

  it("trata campos agregados y quitados como null", () => {
    expect(diffFields({ a: 1 }, { b: 2 })).toEqual([
      { field: "a", from: 1, to: null },
      { field: "b", from: null, to: 2 },
    ]);
  });

  it("en una creación lista todos los campos con valor", () => {
    expect(diffFields(null, { id: "t-1", title: "Hola", link: null })).toEqual([
      { field: "id", from: null, to: "t-1" },
      { field: "title", from: null, to: "Hola" },
    ]);
  });

  it("compara objetos y arreglos por contenido, sin importar el orden de claves", () => {
    const before = { labels: [{ id: "l", name: "A" }], meta: { x: 1, y: 2 } };
    expect(
      diffFields(before, {
        labels: [{ name: "A", id: "l" }],
        meta: { y: 2, x: 1 },
      }),
    ).toEqual([]);
    expect(diffFields(before, { labels: [], meta: { x: 1, y: 2 } })).toEqual([
      { field: "labels", from: [{ id: "l", name: "A" }], to: [] },
    ]);
  });

  it("ignora los campos indicados", () => {
    expect(
      diffFields({ a: 1, noise: 1 }, { a: 1, noise: 2 }, { ignore: ["noise"] }),
    ).toEqual([]);
  });

  it("no comparte referencias con los estados originales", () => {
    const before = { meta: { x: 1 } };
    const [change] = diffFields(before, { meta: { x: 2 } });
    (change.from as { x: number }).x = 99;
    expect(before.meta.x).toBe(1);
  });
});

describe("taskEventType", () => {
  const base = { id: "t", title: "A", status: "todo", assigneeId: null };
  it("distingue creación, movimiento, asignación y edición", () => {
    expect(taskEventType(null, base)).toBe("task.created");
    expect(taskEventType(base, { ...base, status: "done" })).toBe("task.moved");
    expect(taskEventType(base, { ...base, assigneeId: "u" })).toBe(
      "task.assigned",
    );
    expect(taskEventType(base, { ...base, title: "B" })).toBe("task.edited");
    expect(taskEventType(base, { ...base, title: "B", status: "done" })).toBe(
      "task.edited",
    );
  });
});

describe("entityLabel y entityProjectId", () => {
  it("toma el nombre visible según la tabla", () => {
    expect(entityLabel("tasks", { title: "Tarea" })).toBe("Tarea");
    expect(entityLabel("projects", { name: "Fivuza" })).toBe("Fivuza");
    expect(entityLabel("project_labels", { name: "Diseño" })).toBe("Diseño");
    expect(entityLabel("sprints", { goal: "Lanzar" })).toBe("Lanzar");
    expect(entityLabel("time_entries", { description: "Revisión" })).toBe(
      "Revisión",
    );
    expect(entityLabel("time_entries", {})).toBe("Registro de horas");
  });

  it("resuelve el proyecto de cada registro", () => {
    expect(entityProjectId("tasks", { projectId: "p-1" })).toBe("p-1");
    expect(entityProjectId("projects", { id: "p-2" })).toBe("p-2");
    expect(entityProjectId("tasks", { projectId: null })).toBeNull();
    expect(entityProjectId("profiles", { id: "u" })).toBeNull();
  });
});
