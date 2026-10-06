import { describe, expect, it } from "vitest";
import type {
  Expense,
  ExpenseVote,
  MemberMonthlySummary,
  Sprint,
  Task,
} from "@vexa/domain/types";
import {
  canSeeTeamTasks,
  pendingExpenseReview,
  projectProgressLabel,
  sprintProgressCaption,
  sprintTaskCounts,
  taskProjectLabel,
  taskSprintLabel,
  teamMonthStats,
} from "./dashboard-selectors";

const expense = (id: string, patch: Partial<Expense> = {}): Expense => ({
  id,
  paidBy: "other",
  amount: 100,
  currency: "PEN",
  concept: id,
  category: "other",
  receiptUrl: null,
  status: "pending",
  reimbursed: false,
  beforeSigning: false,
  createdAt: "2026-10-01T10:00:00.000Z",
  voidReason: null,
  ...patch,
});
const vote = (
  expenseId: string,
  userId: string,
  inFavor = true,
): ExpenseVote => ({
  expenseId,
  userId,
  inFavor,
});

describe("canSeeTeamTasks", () => {
  it("only admins receive other people's tasks from the services", () => {
    expect(canSeeTeamTasks("admin")).toBe(true);
    expect(canSeeTeamTasks("partner")).toBe(false);
    expect(canSeeTeamTasks("collaborator")).toBe(false);
  });
});

describe("pendingExpenseReview", () => {
  it("keeps only pending expenses, oldest first, and reports how many are hidden", () => {
    const result = pendingExpenseReview(
      [
        expense("new", { createdAt: "2026-10-03T00:00:00.000Z" }),
        expense("approved", { status: "approved" }),
        expense("old", { createdAt: "2026-10-01T00:00:00.000Z" }),
        expense("mid", { createdAt: "2026-10-02T00:00:00.000Z" }),
      ],
      [],
      "me",
      2,
    );
    expect(result.total).toBe(3);
    expect(result.items.map((i) => i.expense.id)).toEqual(["old", "mid"]);
    expect(result.hidden).toBe(1);
  });
  it("counts only in-favor votes and flags whether I already voted", () => {
    const result = pendingExpenseReview(
      [expense("a")],
      [
        vote("a", "x"),
        vote("a", "y", false),
        vote("a", "me", false),
        vote("b", "x"),
      ],
      "me",
      2,
    );
    expect(result.items[0]).toMatchObject({ inFavor: 1, voted: true });
  });
  it("does not mutate the input", () => {
    const input = [
      expense("b", { createdAt: "2026-10-02T00:00:00.000Z" }),
      expense("a", { createdAt: "2026-10-01T00:00:00.000Z" }),
    ];
    pendingExpenseReview(input, [], "me", 2);
    expect(input.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("projectProgressLabel", () => {
  it("never shows 0/0", () => {
    expect(projectProgressLabel({ done: 0, total: 0 })).toBe("Sin tareas");
    expect(projectProgressLabel({ done: 3, total: 9 })).toBe("3/9");
  });
});

describe("sprintTaskCounts", () => {
  const t = (sprintId: string | null, status: Task["status"]) =>
    ({ sprintId, status }) as Pick<Task, "sprintId" | "status">;
  const tasks = [
    t("s1", "done"),
    t("s1", "todo"),
    t("s1", "done"),
    t("s0", "done"),
    t(null, "todo"),
  ];

  it("counts only the active sprint when there is one", () => {
    expect(sprintTaskCounts(tasks, { id: "s1" })).toEqual({
      scope: "sprint",
      done: 2,
      total: 3,
    });
  });

  it("keeps a sprint without tasks as an empty sprint, not the project count", () => {
    expect(sprintTaskCounts(tasks, { id: "s9" })).toEqual({
      scope: "sprint",
      done: 0,
      total: 0,
    });
  });

  it("falls back to the whole project without an active sprint", () => {
    expect(sprintTaskCounts(tasks, null)).toEqual({
      scope: "project",
      done: 3,
      total: 5,
    });
  });
});

describe("sprintProgressCaption", () => {
  it("names the scope honestly", () => {
    expect(sprintProgressCaption({ scope: "sprint", done: 4, total: 10 })).toBe(
      "tareas del sprint",
    );
    expect(
      sprintProgressCaption({ scope: "project", done: 1, total: 2 }),
    ).toBe("tareas del proyecto");
    expect(sprintProgressCaption({ scope: "sprint", done: 0, total: 0 })).toBe(
      "",
    );
  });
});

describe("taskProjectLabel", () => {
  const task = (projectId: string | null) => ({ projectId }) as Task;
  it("falls back instead of rendering an empty name", () => {
    expect(taskProjectLabel(task("p"), "Fivuza")).toBe("Fivuza");
    expect(taskProjectLabel(task("p"), undefined)).toBe("Otro proyecto");
    expect(taskProjectLabel(task(null), undefined)).toBe("Sin proyecto");
  });
});

describe("taskSprintLabel", () => {
  const sprint = (endDate: string) => ({ endDate }) as Sprint;
  it("describes the sprint deadline or the absence of sprint", () => {
    expect(taskSprintLabel(undefined, "2026-10-05")).toBe(
      "Sin sprint asignado",
    );
    expect(taskSprintLabel(sprint("2026-10-04"), "2026-10-05")).toBe(
      "Sprint vencido",
    );
    expect(taskSprintLabel(sprint("2026-10-05"), "2026-10-05")).toBe(
      "Sprint cierra hoy",
    );
    expect(taskSprintLabel(sprint("2026-10-09"), "2026-10-05")).toBe(
      "Cierre de sprint 09/10/2026",
    );
  });
});

describe("teamMonthStats", () => {
  const s = (
    userId: string,
    hours: number,
    meetsMinimum: boolean,
  ): MemberMonthlySummary => ({
    userId,
    month: "2026-10",
    hours,
    minimumHours: 10,
    compliance: hours / 10,
    meetsMinimum,
  });
  it("counts hours and compliance over the same listed members", () => {
    const all = [s("a", 12, true), s("b", 3, false), s("ghost", 40, true)];
    expect(teamMonthStats(all, ["a", "b"])).toEqual({
      hours: 15,
      completed: 1,
      total: 2,
    });
  });
});
