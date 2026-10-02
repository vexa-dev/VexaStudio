import type { Project, Sprint, Task } from "@/domain/types";

/** Orden por cierre del sprint, estado y responsabilidad; no inventa prioridad de tarea. */
export function attentionTasks(
  tasks: Task[],
  projects: Project[],
  sprints: Sprint[],
  userId: string,
  onlyMine = false,
): Task[] {
  const activeProjects = new Set(
    projects.filter((p) => p.status === "active").map((p) => p.id),
  );
  const activeSprints = new Map(
    sprints.filter((s) => s.status === "active").map((s) => [s.id, s]),
  );
  const rank = { review: 0, in_progress: 1, todo: 2, done: 3 };
  return tasks
    .filter(
      (task) =>
        task.status !== "done" &&
        activeProjects.has(task.projectId) &&
        (!task.sprintId || activeSprints.has(task.sprintId)) &&
        (!onlyMine || task.assigneeId === userId),
    )
    .sort((a, b) => {
      const endA = activeSprints.get(a.sprintId ?? "")?.endDate ?? "9999-12-31";
      const endB = activeSprints.get(b.sprintId ?? "")?.endDate ?? "9999-12-31";
      return (
        endA.localeCompare(endB) ||
        rank[a.status] - rank[b.status] ||
        Number(b.assigneeId === userId) - Number(a.assigneeId === userId) ||
        a.title.localeCompare(b.title, "es")
      );
    });
}
