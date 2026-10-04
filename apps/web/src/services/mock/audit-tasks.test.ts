import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { projects, tasks } from "./work";

const JHONY = "u-jhony";

beforeEach(() => {
  resetMock();
  setSessionUserId(JHONY);
});

const last = () => getDb().auditLog.at(-1);

describe("actividad de tareas", () => {
  it("crear deja task.created con el título como foto", async () => {
    const task = await tasks.create({
      title: "Preparar demo",
      projectId: "p-vexa",
      sprintId: null,
      assigneeId: null,
      estimateHours: 2,
      link: null,
    });
    expect(last()).toMatchObject({
      eventType: "task.created",
      actorId: JHONY,
      entity: { id: task.id, label: "Preparar demo", projectId: "p-vexa" },
    });
  });

  it("distingue mover, asignar y editar según lo que cambió", async () => {
    await tasks.move("t-7", "review");
    expect(last()).toMatchObject({
      eventType: "task.moved",
      changes: [{ field: "status", from: "todo", to: "review" }],
    });
    await tasks.update("t-7", { assigneeId: "u-rober" });
    expect(last()?.eventType).toBe("task.assigned");
    await tasks.update("t-7", { title: "Registrar gastos" });
    expect(last()?.eventType).toBe("task.edited");
    expect(last()?.entity.label).toBe("Registrar gastos");
  });

  it("una edición sin cambios o un movimiento al mismo estado no dejan rastro", async () => {
    const before = getDb().auditLog.length;
    const task = getDb().tasks.find((t) => t.id === "t-7")!;
    await tasks.update("t-7", { title: task.title });
    await tasks.move("t-7", task.status);
    expect(getDb().auditLog).toHaveLength(before);
  });

  it("proyectos y etiquetas usan eventos propios", async () => {
    await projects.update("p-vexa", { memberIds: [JHONY, "u-rober"] });
    expect(last()?.eventType).toBe("project.members_changed");
    await projects.update("p-vexa", { name: "Vexa Studio 2" });
    expect(last()).toMatchObject({
      eventType: "project.updated",
      entity: { table: "projects", projectId: "p-vexa" },
    });
    const label = await projects.createLabel("p-vexa", {
      name: "Diseño",
      color: "#447298",
    });
    expect(last()?.eventType).toBe("project_label.created");
    await projects.updateLabel(label.id, { name: "UI", color: "#447298" });
    expect(last()).toMatchObject({
      eventType: "project_label.updated",
      entity: { projectId: "p-vexa", label: "UI" },
    });
  });
});
