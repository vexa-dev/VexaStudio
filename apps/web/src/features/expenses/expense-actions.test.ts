import { describe, expect, it } from "vitest";
import type { Expense, Profile } from "@vexa/domain/types";
import {
  canCreateExpense,
  canVoteExpense,
  canVoidExpense,
  buildExpenseInput,
  validateVoidReason,
  validateReceiptFile,
  receiptMaxBytes,
  selectedExpense,
  summarizeExpenses,
  expenseMonthTotals,
  expenseCategoryTotals,
  filterExpenses,
  votesForExpense,
  expenseDraftFromLocal,
  expenseStatusLabels,
  EXPENSE_APPROVALS_REQUIRED,
} from "./expense-actions";

const user = { id: "u1", role: "partner", active: true } as Profile;
const expense: Expense = {
  id: "e1",
  paidBy: "u1",
  amount: 200,
  currency: "PEN",
  concept: "Equipo",
  category: "infrastructure",
  receiptUrl: null,
  status: "pending",
  reimbursed: false,
  beforeSigning: false,
  createdAt: "2026-10-06T12:00:00Z",
  voidReason: null,
};
const draft = {
  amount: "12.50",
  concept: "  Licencia  ",
  currency: "PEN",
  category: "software",
  receiptUrl: null,
  beforeSigning: false,
};

describe("expense UI actions", () => {
  it("allows only active studio members and blocks pending submissions", () => {
    expect(canCreateExpense(user)).toBe(true);
    expect(canCreateExpense({ ...user, role: "admin" })).toBe(true);
    expect(canCreateExpense({ ...user, role: "collaborator" })).toBe(false);
    expect(canCreateExpense({ ...user, active: false })).toBe(false);
    expect(canCreateExpense(null)).toBe(false);
    expect(canCreateExpense(user, true)).toBe(false);
  });
  it("allows one vote per eligible member on a pending expense, including its payer", () => {
    expect(canVoteExpense(user, expense, [])).toBe(true);
    expect(
      canVoteExpense(user, expense, [
        { expenseId: "other", userId: user.id, inFavor: true },
      ]),
    ).toBe(true);
    expect(
      canVoteExpense(user, expense, [
        { expenseId: expense.id, userId: user.id, inFavor: false },
      ]),
    ).toBe(false);
    expect(canVoteExpense(user, expense, [], true)).toBe(false);
    expect(canVoteExpense({ ...user, active: false }, expense, [])).toBe(false);
    expect(canVoteExpense({ ...user, role: "collaborator" }, expense, [])).toBe(
      false,
    );
    for (const status of ["approved", "rejected", "voided"] as const)
      expect(canVoteExpense(user, { ...expense, status }, [])).toBe(false);
  });
  it("restricts void to the active payer and matches the minimum reason length", () => {
    expect(canVoidExpense(user, expense)).toBe(true);
    expect(
      canVoidExpense({ ...user, id: "other", role: "admin" }, expense),
    ).toBe(false);
    expect(canVoidExpense({ ...user, role: "collaborator" }, expense)).toBe(
      false,
    );
    expect(canVoidExpense({ ...user, active: false }, expense)).toBe(false);
    expect(canVoidExpense(user, { ...expense, status: "voided" })).toBe(false);
    expect(canVoidExpense(user, expense, true)).toBe(false);
    expect(validateVoidReason("  Duplicado  ")).toBe("Duplicado");
    for (const reason of ["", "   ", "ab"])
      expect(() => validateVoidReason(reason)).toThrow();
  });
  it("normalizes the actual create input and rejects invalid money, concept and enum values", () => {
    expect(buildExpenseInput(draft, "mock")).toEqual({
      ...draft,
      amount: 12.5,
      concept: "Licencia",
    });
    for (const amount of ["", "0", "-1", "NaN", "Infinity", "1e3", "1.234"])
      expect(() => buildExpenseInput({ ...draft, amount }, "mock")).toThrow();
    expect(() =>
      buildExpenseInput({ ...draft, concept: "  " }, "mock"),
    ).toThrow();
    expect(() =>
      buildExpenseInput({ ...draft, currency: "EUR" }, "mock"),
    ).toThrow();
    expect(() =>
      buildExpenseInput({ ...draft, category: "unknown" }, "mock"),
    ).toThrow();
  });
  it("uses the source receipt limit and validates both files and create data URLs", () => {
    expect(receiptMaxBytes("mock")).toBe(3 * 1024 * 1024);
    expect(receiptMaxBytes("supabase")).toBe(5 * 1024 * 1024);
    expect(() =>
      validateReceiptFile(
        { type: "application/pdf", size: 4 * 1024 * 1024 },
        "mock",
      ),
    ).toThrow();
    expect(() =>
      validateReceiptFile(
        { type: "application/pdf", size: 4 * 1024 * 1024 },
        "supabase",
      ),
    ).not.toThrow();
    expect(() =>
      validateReceiptFile({ type: "image/gif", size: 100 }, "mock"),
    ).toThrow();
    expect(() =>
      validateReceiptFile({ type: "image/png", size: 0 }, "mock"),
    ).toThrow();
    const receiptUrl = `data:application/pdf;base64,${"AAAA".repeat(((4 * 1024 * 1024) / 3) | 0)}`;
    expect(() => buildExpenseInput({ ...draft, receiptUrl }, "mock")).toThrow();
    expect(() =>
      buildExpenseInput({ ...draft, receiptUrl }, "supabase"),
    ).not.toThrow();
    expect(() =>
      buildExpenseInput(
        { ...draft, receiptUrl: "https://example.com/file.pdf" },
        "supabase",
      ),
    ).toThrow();
  });
  it("resolves selected detail from refreshed data rather than a stale object", () => {
    const refreshed = { ...expense, status: "approved" as const };
    expect(selectedExpense([expense], "e1")).toBe(expense);
    expect(selectedExpense([refreshed], "e1")).toBe(refreshed);
    expect(selectedExpense([], "e1")).toBeNull();
    expect(selectedExpense([expense], null)).toBeNull();
  });
});

describe("expense overview rules", () => {
  const at = (id: string, patch: Partial<Expense>): Expense => ({
    ...expense,
    id,
    ...patch,
  });
  const list = [
    at("a", {
      status: "approved",
      amount: 100,
      createdAt: "2026-10-03T15:00:00Z",
    }),
    at("b", {
      status: "approved",
      amount: 40,
      currency: "USD",
      createdAt: "2026-10-04T15:00:00Z",
    }),
    at("c", {
      status: "pending",
      amount: 60,
      createdAt: "2026-10-05T15:00:00Z",
    }),
    at("d", {
      status: "voided",
      amount: 500,
      createdAt: "2026-10-05T16:00:00Z",
    }),
    at("e", {
      status: "approved",
      amount: 25,
      category: "software",
      createdAt: "2026-09-30T03:00:00Z",
    }),
  ];
  it("sums only approved expenses of one currency and counts pending ones", () => {
    expect(summarizeExpenses(list, "PEN", null)).toEqual({
      spent: 125,
      approvedCount: 2,
      pendingAmount: 60,
      pendingCount: 1,
    });
    expect(summarizeExpenses(list, "USD", null).spent).toBe(40);
  });
  it("applies the month filter in Lima time", () => {
    // 2026-09-30T03:00Z is 22:00 of Sep 29 in Lima.
    expect(summarizeExpenses(list, "PEN", "2026-10").spent).toBe(100);
    expect(summarizeExpenses(list, "PEN", "2026-09").spent).toBe(25);
  });
  it("totals approved expenses per month and per category", () => {
    expect(expenseMonthTotals(list, "PEN", ["2026-09", "2026-10"])).toEqual([
      25, 100,
    ]);
    expect(expenseCategoryTotals(list, "PEN", null)).toEqual({
      infrastructure: 100,
      software: 25,
      marketing: 0,
      legal: 0,
      other: 0,
    });
  });
  it("filters by concept text and status, newest first", () => {
    const named = [
      at("x", { concept: "Dominio", createdAt: "2026-10-01T12:00:00Z" }),
      at("y", {
        concept: "Hosting",
        createdAt: "2026-10-02T12:00:00Z",
        status: "approved",
      }),
    ];
    expect(filterExpenses(named, "", "all").map((e) => e.id)).toEqual([
      "y",
      "x",
    ]);
    expect(filterExpenses(named, "domi", "all").map((e) => e.id)).toEqual([
      "x",
    ]);
    expect(filterExpenses(named, "", "approved").map((e) => e.id)).toEqual([
      "y",
    ]);
  });
  it("selects the votes of one expense and exposes the approval rule", () => {
    const votes = [
      { expenseId: "a", userId: "u1", inFavor: true },
      { expenseId: "b", userId: "u2", inFavor: false },
    ];
    expect(votesForExpense(votes, "a")).toEqual([votes[0]]);
    expect(EXPENSE_APPROVALS_REQUIRED).toBe(3);
    expect(expenseStatusLabels.voided).toBe("Anulado");
  });
  it("builds a draft from a local preview item with a mapped category", () => {
    expect(
      expenseDraftFromLocal(
        { title: "Figma", category: "Publicidad" },
        60,
        "USD",
      ),
    ).toMatchObject({
      concept: "Figma",
      amount: "60",
      currency: "USD",
      category: "marketing",
    });
    expect(
      expenseDraftFromLocal(
        { title: "X", category: "Operaciones" },
        10.5,
        "PEN",
      ).category,
    ).toBe("other");
  });
});
