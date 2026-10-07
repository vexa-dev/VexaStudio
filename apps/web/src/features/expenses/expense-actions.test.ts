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
