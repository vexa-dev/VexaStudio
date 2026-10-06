import type { Project, Task, TimeEntry } from "@vexa/domain/types";

export interface WorkingNow {
  source: "timer" | "manual";
  projectName: string | null;
  taskTitle: string | null;
}

interface WorkingNowInput {
  running: TimeEntry | null;
  manualProjectId: string | null;
  tasks: Pick<Task, "id" | "title" | "projectId">[];
  projects: Pick<Project, "id" | "name">[];
}

const isRunning = (entry: TimeEntry | null): entry is TimeEntry =>
  !!entry &&
  entry.endedAt === null &&
  !entry.voidedAt &&
  entry.timerState !== "paused";

/** What someone is working on: open timer first, then the pinned project. */
export function resolveWorkingNow({
  running,
  manualProjectId,
  tasks,
  projects,
}: WorkingNowInput): WorkingNow | null {
  const nameOf = (id: string | null | undefined) =>
    (id && projects.find((p) => p.id === id)?.name) || null;
  if (isRunning(running)) {
    const task = running.taskId
      ? tasks.find((t) => t.id === running.taskId)
      : undefined;
    const projectName = nameOf(running.projectId ?? task?.projectId);
    const taskTitle = task?.title ?? null;
    if (projectName || taskTitle)
      return { source: "timer", projectName, taskTitle };
  }
  const manualName = nameOf(manualProjectId);
  return manualName
    ? { source: "manual", projectName: manualName, taskTitle: null }
    : null;
}
