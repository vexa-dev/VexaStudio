import type {
  Expense,
  ExpenseVote,
  MemberMonthlySummary,
  Role,
  Sprint,
  Task,
} from "@vexa/domain/types";
import { formatIsoDate } from "@vexa/domain/dates";

/** The task services only return other people's tasks to admins; everyone else gets their own. */
export function canSeeTeamTasks(role: Role): boolean {
  return role === "admin";
}

export interface PendingExpenseItem {
  expense: Expense;
  /** Votes in favor only. */
  inFavor: number;
  /** Whether the current user already cast a vote (in favor or against). */
  voted: boolean;
}

/** Pending expenses, oldest first, with the total so the card can say how many are not listed. */
export function pendingExpenseReview(
  expenses: Expense[],
  votes: ExpenseVote[],
  userId: string,
  limit: number,
): { total: number; hidden: number; items: PendingExpenseItem[] } {
  const pending = expenses
    .filter((expense) => expense.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const items = pending.slice(0, limit).map((expense) => {
    const own = votes.filter((v) => v.expenseId === expense.id);
    return {
      expense,
      inFavor: own.filter((v) => v.inFavor).length,
      voted: own.some((v) => v.userId === userId),
    };
  });
  return {
    total: pending.length,
    hidden: Math.max(pending.length - items.length, 0),
    items,
  };
}

export function projectProgressLabel(progress: {
  done: number;
  total: number;
}): string {
  return progress.total === 0
    ? "Sin tareas"
    : `${progress.done}/${progress.total}`;
}

export interface TaskProgress {
  /** What the counts cover, so the card never calls project totals "sprint" progress. */
  scope: "sprint" | "project";
  done: number;
  total: number;
}

/** Progress of the active sprint, or of the whole project when no sprint is active. */
export function sprintTaskCounts(
  tasks: Pick<Task, "sprintId" | "status">[],
  sprint: Pick<Sprint, "id"> | null,
): TaskProgress {
  const scoped = sprint
    ? tasks.filter((task) => task.sprintId === sprint.id)
    : tasks;
  return {
    scope: sprint ? "sprint" : "project",
    done: scoped.filter((task) => task.status === "done").length,
    total: scoped.length,
  };
}

/** Text after the "4/10" figure; empty when there is nothing to count. */
export function sprintProgressCaption(progress: TaskProgress): string {
  if (progress.total === 0) return "";
  return progress.scope === "sprint" ? "tareas del sprint" : "tareas del proyecto";
}

export function taskProjectLabel(
  task: Pick<Task, "projectId">,
  projectName: string | undefined,
): string {
  if (projectName) return projectName;
  return task.projectId ? "Otro proyecto" : "Sin proyecto";
}

export function taskSprintLabel(
  sprint: Pick<Sprint, "endDate"> | undefined,
  today: string,
): string {
  if (!sprint) return "Sin sprint asignado";
  if (sprint.endDate < today) return "Sprint vencido";
  if (sprint.endDate === today) return "Sprint cierra hoy";
  return `Cierre de sprint ${formatIsoDate(sprint.endDate)}`;
}

/** Hours and compliance computed over the same members the card lists. */
export function teamMonthStats(
  summaries: MemberMonthlySummary[],
  listedUserIds: string[],
): { hours: number; completed: number; total: number } {
  const listed = summaries.filter((s) => listedUserIds.includes(s.userId));
  return {
    hours: listed.reduce((sum, s) => sum + s.hours, 0),
    completed: listed.filter((s) => s.meetsMinimum).length,
    total: listed.length,
  };
}
