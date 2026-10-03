import { useQuery } from "@tanstack/react-query";
import type { Project, Sprint, TaskStatus } from "@vexa/domain/types";
import { monthKey } from "@vexa/domain/dates";
import { monthlyActivity } from "@vexa/domain/time-activity";
import { services } from "@/services";

export interface ProjectSummary {
  project: Project;
  /** Sprint activo del proyecto, si existe. */
  sprint: Sprint | null;
  tasksByStatus: Record<TaskStatus, number>;
  taskCount: number;
  /** Horas registradas por todo el equipo este mes (Lima) en tareas del proyecto. */
  monthHours: number;
}

const emptyCounts = (): Record<TaskStatus, number> => ({
  todo: 0,
  in_progress: 0,
  review: 0,
  done: 0,
});

/** Proyectos con lo que hace falta para decidir dónde trabajar: sprint, avance de tareas y horas del mes. */
export function useProjectSummaries() {
  return useQuery({
    queryKey: ["projects", "summaries"],
    queryFn: async (): Promise<ProjectSummary[]> => {
      const month = monthKey(new Date());
      const [projects, entries] = await Promise.all([
        services.projects.list(),
        services.time.listEntries(),
      ]);
      const projectTasks = await Promise.all(
        projects.map((p) => services.tasks.list({ projectId: p.id })),
      );
      const tasks = projectTasks.flat();
      const sprints = await Promise.all(
        projects.map((p) => services.sprints.getActive(p.id)),
      );
      const projectOfTask = new Map(tasks.map((t) => [t.id, t.projectId]));

      return projects.map((project, i) => {
        const sprint = sprints[i];
        const scoped = projectTasks[i];
        const tasksByStatus = emptyCounts();
        for (const task of scoped) tasksByStatus[task.status] += 1;
        const monthHours = entries
          .filter((e) => !e.draft && !e.voidedAt && e.endedAt)
          .reduce((sum, e) => {
            const clippedHours = monthlyActivity([e], month).total;
            if (e.allocations?.length)
              return (
                sum +
                e.allocations
                  .filter((a) => a.projectId === project.id)
                  .reduce(
                    (n, a) =>
                      n +
                      (e.hours > 0 ? (clippedHours * a.hours) / e.hours : 0),
                    0,
                  )
              );
            return (
              sum +
              ((e.taskId ? projectOfTask.get(e.taskId) : e.projectId) ===
              project.id
                ? clippedHours
                : 0)
            );
          }, 0);
        return {
          project,
          sprint,
          tasksByStatus,
          taskCount: scoped.length,
          monthHours,
        };
      });
    },
  });
}
