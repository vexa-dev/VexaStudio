import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok, profileRow } from "./fake-client";
import { createTaskService } from "./tasks";

const taskRow = (id: string, assignee: string | null) => ({
  id,
  sprint_id: null,
  project_id: "p1",
  title: `Tarea ${id}`,
  description: null,
  status: "todo",
  assignee_id: assignee,
  estimate_hours: null,
  link: null,
  hours_prepared: false,
  created_at: "2026-10-03T17:00:00+00:00",
  updated_at: "2026-10-03T17:00:00+00:00",
  task_labels: [],
});

const rows = [taskRow("t1", "u1"), taskRow("t2", "u2")];

describe("TaskService de Supabase", () => {
  it("'Mis tareas' muestra solo las asignadas a un socio", async () => {
    const { client } = fakeClient({
      tables: { tasks: ok(rows), profiles: ok(profileRow("partner")) },
    });
    const tasks = await createTaskService(client).list();
    expect(tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("el administrador ve todas las tareas", async () => {
    const { client } = fakeClient({
      tables: { tasks: ok(rows), profiles: ok(profileRow("admin")) },
    });
    expect((await createTaskService(client).list()).map((t) => t.id)).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("el tablero de un proyecto muestra todo lo que RLS deja ver", async () => {
    const { client, calls } = fakeClient({
      tables: { tasks: ok(rows), profiles: ok(profileRow("collaborator")) },
    });
    const tasks = await createTaskService(client).list({ projectId: "p1" });
    expect(tasks).toHaveLength(2);
    expect(argsOf(calls, "tasks", "eq")[0]).toEqual(["project_id", "p1"]);
  });

  it("mover una tarea ajena falla con el mensaje del mock", async () => {
    // RLS deja el UPDATE sin filas y `move_task` devuelve un registro vacío.
    const { client } = fakeClient({
      rpc: { move_task: ok({ id: null }) },
      tables: { tasks: ok(taskRow("t2", "u2")) },
    });
    await expect(createTaskService(client).move("t2", "done")).rejects.toThrow(
      "Solo puedes trabajar en tus tareas asignadas",
    );
  });

  it("crea la tarea y fija sus etiquetas en la misma operación", async () => {
    const { client, calls } = fakeClient({
      tables: { tasks: ok({ ...taskRow("t3", null) }) },
      rpc: { set_task_labels: ok([]) },
    });
    await createTaskService(client).create({
      sprintId: null,
      projectId: "p1",
      title: "  Nueva  ",
      assigneeId: null,
      estimateHours: null,
      link: null,
      labels: [{ id: "l1", projectId: "p1", name: "Bug", color: "#ff0000" }],
    });
    expect(argsOf(calls, "tasks", "insert")[0][0]).toMatchObject({
      title: "Nueva",
      status: "todo",
      project_id: "p1",
    });
    expect(argsOf(calls, "rpc:set_task_labels", "call")[0][0]).toEqual({
      p_task: "t3",
      p_label_ids: ["l1"],
    });
    // Insert y etiquetas comparten el mismo x-request-id.
    const ids = calls
      .filter((c) => c.method === "setHeader")
      .map((c) => c.args[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
  });

  it("valida título y etiquetas sin proyecto antes de ir a la red", async () => {
    const { client, calls } = fakeClient();
    const service = createTaskService(client);
    const base = {
      sprintId: null,
      projectId: null,
      assigneeId: null,
      estimateHours: null,
      link: null,
    };
    await expect(service.create({ ...base, title: " " })).rejects.toThrow(
      "Escribe el título de la tarea",
    );
    await expect(
      service.create({
        ...base,
        title: "X",
        labels: [{ id: "l1", projectId: "p1", name: "B", color: "#000000" }],
      }),
    ).rejects.toThrow("Las etiquetas deben pertenecer al proyecto de la tarea");
    expect(calls).toHaveLength(0);
  });
});
