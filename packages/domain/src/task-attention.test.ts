import { describe, expect, it } from "vitest";
import type { Project, Sprint, Task } from "./types";
import { attentionTasks } from "./task-attention";

const projects: Project[] = [
  { id: "active", name: "Activo", type: "internal", status: "active" },
  { id: "paused", name: "Pausado", type: "product", status: "paused" },
];
const sprint = (
  id: string,
  endDate: string,
  status: Sprint["status"] = "active",
): Sprint => ({
  id,
  projectId: "active",
  startDate: "2026-10-01",
  endDate,
  status,
  goal: "Entregar",
});
const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  title: id,
  projectId: "active",
  sprintId: null,
  assigneeId: "me",
  status: "todo",
  estimateHours: null,
  link: null,
  ...patch,
});

describe("tareas por atender", () => {
  it("excluye trabajo terminado, proyectos pausados y sprints cerrados", () => {
    const result = attentionTasks(
      [
        task("done", { status: "done" }),
        task("paused", { projectId: "paused" }),
        task("closed", { sprintId: "closed" }),
        task("open"),
      ],
      projects,
      [sprint("closed", "2026-10-02", "closed")],
      "me",
    );
    expect(result.map((t) => t.id)).toEqual(["open"]);
  });
  it("atiende primero el sprint que cierra antes y deja el backlog al final", () => {
    const result = attentionTasks(
      [
        task("later", { sprintId: "later", status: "review" }),
        task("backlog"),
        task("sooner", { sprintId: "sooner" }),
      ],
      projects,
      [sprint("later", "2026-10-09"), sprint("sooner", "2026-10-03")],
      "me",
    );
    expect(result.map((t) => t.id)).toEqual(["sooner", "later", "backlog"]);
  });
  it("prioriza revisión y trabajo en curso dentro del mismo sprint", () => {
    const result = attentionTasks(
      [
        task("todo", { sprintId: "now" }),
        task("working", { sprintId: "now", status: "in_progress" }),
        task("review", {
          sprintId: "now",
          status: "review",
          assigneeId: "other",
        }),
      ],
      projects,
      [sprint("now", "2026-10-08")],
      "me",
    );
    expect(result.map((t) => t.id)).toEqual(["review", "working", "todo"]);
  });
  it("filtra las tareas propias y conserva sin cambios la entrada", () => {
    const tasks = [
      task("other", { assigneeId: "other" }),
      task("mine"),
      task("unassigned", { assigneeId: null }),
    ];
    const result = attentionTasks(tasks, projects, [], "me", true);
    expect(result.map((t) => t.id)).toEqual(["mine"]);
    expect(tasks.map((t) => t.id)).toEqual(["other", "mine", "unassigned"]);
  });
});
