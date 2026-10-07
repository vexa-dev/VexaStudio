import { canAccessStudio } from "@vexa/domain/access";
import {
  parseReceiptDataUrl,
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME_TYPES,
} from "@vexa/domain/rules";
import { monthKey } from "@vexa/domain/dates";
import type {
  Currency,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  ExpenseVote,
  Profile,
} from "@vexa/domain/types";
import type { NewExpenseInput } from "@vexa/services";
import type { DataSource } from "@/services/supabase/data-source";

export const expenseCategories = {
  infrastructure: "Infraestructura",
  software: "Software",
  marketing: "Marketing",
  legal: "Legal",
  other: "Otro",
};

export function canCreateExpense(
  user: Profile | null,
  pending = false,
): boolean {
  return !pending && Boolean(user?.active && canAccessStudio(user.role));
}

export function canVoteExpense(
  user: Profile | null,
  expense: Expense,
  votes: ExpenseVote[],
  pending = false,
): boolean {
  return (
    canCreateExpense(user, pending) &&
    expense.status === "pending" &&
    !votes.some(
      (vote) => vote.expenseId === expense.id && vote.userId === user?.id,
    )
  );
}

export function canVoidExpense(
  user: Profile | null,
  expense: Expense,
  pending = false,
): boolean {
  return (
    canCreateExpense(user, pending) &&
    expense.paidBy === user?.id &&
    expense.status !== "voided"
  );
}

export function validateVoidReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < 3)
    throw new Error("Escribe un motivo de al menos 3 caracteres.");
  return clean;
}

export function receiptMaxBytes(source: DataSource): number {
  return source === "supabase" ? RECEIPT_MAX_BYTES : 3 * 1024 * 1024;
}

export function validateReceiptFile(
  file: { type: string; size: number },
  source: DataSource,
): void {
  if (
    !(RECEIPT_MIME_TYPES as readonly string[]).includes(file.type) ||
    file.size <= 0
  )
    throw new Error("Elige un comprobante JPEG, PNG, WebP o PDF válido.");
  if (file.size > receiptMaxBytes(source))
    throw new Error(
      `El comprobante debe pesar como máximo ${receiptMaxBytes(source) / 1024 / 1024} MiB.`,
    );
}

export interface ExpenseDraft {
  amount: string;
  concept: string;
  currency: string;
  category: string;
  receiptUrl: string | null;
  beforeSigning: boolean;
}

export function buildExpenseInput(
  draft: ExpenseDraft,
  source: DataSource,
): NewExpenseInput {
  const amount = Number(draft.amount);
  if (
    !/^\d+(\.\d{1,2})?$/.test(draft.amount.trim()) ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    throw new Error("Escribe un monto mayor a cero, con hasta 2 decimales.");
  const concept = draft.concept.trim();
  if (!concept) throw new Error("Escribe el concepto del gasto.");
  if (draft.currency !== "PEN" && draft.currency !== "USD")
    throw new Error("Elige una moneda válida.");
  if (!Object.hasOwn(expenseCategories, draft.category))
    throw new Error("Elige una categoría válida.");
  if (draft.receiptUrl !== null) {
    const receipt = parseReceiptDataUrl(draft.receiptUrl);
    if (!receipt) throw new Error("El comprobante no es válido.");
    validateReceiptFile({ type: receipt.mime, size: receipt.bytes }, source);
  }
  return {
    amount,
    concept,
    currency: draft.currency,
    category: draft.category as Expense["category"],
    receiptUrl: draft.receiptUrl,
    beforeSigning: draft.beforeSigning,
  };
}

export function selectedExpense(
  expenses: Expense[],
  id: string | null,
): Expense | null {
  return expenses.find((expense) => expense.id === id) ?? null;
}

export function expenseErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudo guardar el cambio. Inténtalo de nuevo.";
}

/** Votos a favor que aprueban un gasto por encima del límite (regla del PRD). */
export const EXPENSE_APPROVALS_REQUIRED = 3;

export const expenseStatusLabels: Record<ExpenseStatus, string> = {
  pending: "Por aprobar",
  approved: "Aprobado",
  rejected: "Rechazado",
  voided: "Anulado",
};

const inMonth = (expense: Expense, month: string | null) =>
  month === null || monthKey(expense.createdAt) === month;

/** Totales reales: solo gastos aprobados suman al gasto; los anulados no cuentan. */
export function summarizeExpenses(
  expenses: Expense[],
  currency: Currency,
  month: string | null,
) {
  let spent = 0;
  let approvedCount = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  for (const expense of expenses) {
    if (expense.currency !== currency || !inMonth(expense, month)) continue;
    if (expense.status === "approved") {
      spent += expense.amount;
      approvedCount += 1;
    } else if (expense.status === "pending") {
      pendingAmount += expense.amount;
      pendingCount += 1;
    }
  }
  return { spent, approvedCount, pendingAmount, pendingCount };
}

export function expenseMonthTotals(
  expenses: Expense[],
  currency: Currency,
  months: string[],
): number[] {
  return months.map((month) =>
    expenses
      .filter(
        (expense) =>
          expense.status === "approved" &&
          expense.currency === currency &&
          monthKey(expense.createdAt) === month,
      )
      .reduce((sum, expense) => sum + expense.amount, 0),
  );
}

export function expenseCategoryTotals(
  expenses: Expense[],
  currency: Currency,
  month: string | null,
): Record<ExpenseCategory, number> {
  const totals: Record<ExpenseCategory, number> = {
    infrastructure: 0,
    software: 0,
    marketing: 0,
    legal: 0,
    other: 0,
  };
  for (const expense of expenses)
    if (
      expense.status === "approved" &&
      expense.currency === currency &&
      inMonth(expense, month)
    )
      totals[expense.category] += expense.amount;
  return totals;
}

export function filterExpenses(
  expenses: Expense[],
  search: string,
  status: string,
): Expense[] {
  const needle = search.trim().toLowerCase();
  return expenses
    .filter(
      (expense) =>
        expense.concept.toLowerCase().includes(needle) &&
        (status === "all" || expense.status === status),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
}

export function votesForExpense(
  votes: ExpenseVote[],
  expenseId: string,
): ExpenseVote[] {
  return votes.filter((vote) => vote.expenseId === expenseId);
}

const LOCAL_CATEGORY: Record<string, ExpenseCategory> = {
  Publicidad: "marketing",
  Software: "software",
  Infraestructura: "infrastructure",
};

/** Borrador de gasto real a partir de un registro de la vista previa local. */
export function expenseDraftFromLocal(
  item: { title: string; category: string },
  amount: number,
  currency: Currency,
): Partial<ExpenseDraft> {
  return {
    concept: item.title,
    amount: String(amount),
    currency,
    category: LOCAL_CATEGORY[item.category] ?? "other",
  };
}
