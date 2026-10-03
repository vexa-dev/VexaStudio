import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { projects, tasks } from "./work";

beforeEach(() => {
  resetMock();
  setSessionUserId("u-jhony");
  getDb();
});
const input = {
  title: "Trabajo con contexto",
  projectId: "p-fivuza",
  sprintId: null,
  assigneeId: "u-demo-collaborator",
  estimateHours: null,
  link: null,
};
describe("descripciones y etiquetas de proyecto", () => {
  it("conserva Markdown y etiquetas en una tarea externa sin conceder acceso al catálogo", async () => {
    const label = await projects.createLabel("p-fivuza", {
      name: "Diseño",
      color: "#447298",
    });
    const description =
      "## Resultado\n- **Entregar** la propuesta\n- [Referencia](https://example.com)";
    const task = await tasks.create({
      ...input,
      description,
      labels: [{ ...label, name: "Nombre falsificado", color: "#ffffff" }],
    });
    expect(task.labels).toEqual([label]);
    setSessionUserId("u-demo-collaborator");
    expect((await tasks.list()).find((t) => t.id === task.id)).toMatchObject({
      description,
      labels: [label],
    });
    await expect(projects.get("p-fivuza")).rejects.toThrow("acceso");
    await expect(projects.listLabels("p-fivuza")).rejects.toThrow(
      "administrador",
    );
    await expect(projects.listLabels("p-vexa")).rejects.toThrow(
      "administrador",
    );
    await expect(
      tasks.update(task.id, { description: "Alterada" }),
    ).rejects.toThrow("administrador");
    await expect(tasks.update(task.id, { labels: [] })).rejects.toThrow(
      "administrador",
    );
    await expect(
      projects.createLabel("p-vexa", { name: "Privada", color: "#447298" }),
    ).rejects.toThrow("administrador");
    await expect(
      projects.updateLabel(label.id, { name: "Alterada", color: "#447298" }),
    ).rejects.toThrow("administrador");
  });
  it("propaga nombre y color a todas las tareas", async () => {
    const label = await projects.createLabel("p-fivuza", {
      name: "Diseño",
      color: "#447298",
    });
    const first = await tasks.create({ ...input, labels: [label] });
    const second = await tasks.create({
      ...input,
      title: "Otra tarea",
      labels: [label],
    });
    const changed = await projects.updateLabel(label.id, {
      name: " Interfaz ",
      color: "#995557",
    });
    expect(changed.name).toBe("Interfaz");
    const list = await tasks.list();
    for (const id of [first.id, second.id])
      expect(list.find((t) => t.id === id)?.labels).toEqual([changed]);
  });
  it("rechaza etiquetas ajenas, inexistentes o sin proyecto sin modificar tareas", async () => {
    const label = await projects.createLabel("p-vexa", {
      name: "Interno",
      color: "#477860",
    });
    const count = getDb().tasks.length;
    await expect(tasks.create({ ...input, labels: [label] })).rejects.toThrow(
      "pertenecer",
    );
    await expect(
      tasks.create({ ...input, projectId: null, labels: [label] }),
    ).rejects.toThrow("pertenecer");
    await expect(
      tasks.create({ ...input, labels: [{ ...label, id: "no-existe" }] }),
    ).rejects.toThrow("pertenecer");
    expect(getDb().tasks).toHaveLength(count);
    const task = await tasks.create({
      ...input,
      projectId: "p-vexa",
      labels: [label],
    });
    await expect(
      tasks.update(task.id, { projectId: "p-fivuza" }),
    ).rejects.toThrow("pertenecer");
    expect(getDb().tasks.find((t) => t.id === task.id)?.projectId).toBe(
      "p-vexa",
    );
    expect(
      (await tasks.update(task.id, { projectId: "p-fivuza", labels: [] }))
        .labels,
    ).toEqual([]);
  });
  it("valida nombres y colores, permite el mismo nombre en otro proyecto y descripción vacía", async () => {
    const label = await projects.createLabel("p-vexa", {
      name: "Diseño",
      color: "#447298",
    });
    const auditCount = getDb().auditLog.length;
    await expect(
      projects.createLabel("p-vexa", { name: " diseño ", color: "#447298" }),
    ).rejects.toThrow("Ya existe");
    await expect(
      projects.updateLabel(label.id, { name: "", color: "#447298" }),
    ).rejects.toThrow("nombre");
    await expect(
      projects.updateLabel(label.id, { name: "Diseño", color: "red" }),
    ).rejects.toThrow("color");
    expect(getDb().auditLog).toHaveLength(auditCount);
    await projects.createLabel("p-fivuza", {
      name: "Diseño",
      color: "#447298",
    });
    await expect(
      tasks.create({ ...input, description: "x".repeat(20001) }),
    ).rejects.toThrow("caracteres");
    const task = await tasks.create(input);
    expect(task.description).toBeUndefined();
    expect((await tasks.update(task.id, { description: "" })).description).toBe(
      "",
    );
  });
});
