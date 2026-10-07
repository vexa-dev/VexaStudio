import { canAccessStudio } from "@vexa/domain/access";
import {
  parseReceiptDataUrl,
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME_TYPES,
} from "@vexa/domain/rules";
import type { Expense, ExpenseVote, Profile } from "@vexa/domain/types";
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
