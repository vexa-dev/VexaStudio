import { parseReceiptDataUrl, resolveExpenseStatus } from "@vexa/domain/rules";
import type { Expense, Id } from "@vexa/domain/types";
import type { ExpenseService } from "@vexa/services";
import { getDb, getSessionUserId, save } from "./db";
import { scoped } from "./audit";
import { requireStudioAccess } from "./studio-access";
import { delay } from "./utils";

/** Tope del comprobante en el mock (el bucket de Supabase admite 5 MiB). */
export const MOCK_RECEIPT_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Gastos del mock. Espeja las reglas de SQL (`create_expense`, `vote_expense`, `void_expense` y sus
 * guardas): solo socios y administradores; el estado lo fija el servicio, no quien llama; nadie edita
 * ni borra, se anula con motivo. Igual que en Supabase, los gastos aún no generan actividad auditada.
 */
function currentUserId(): Id {
  requireStudioAccess();
  const id = getSessionUserId();
  if (!id) throw new Error("Inicia sesión para continuar");
  return id;
}

function findExpense(id: Id): Expense {
  const expense = getDb().expenses.find((e) => e.id === id);
  if (!expense) throw new Error("El gasto no existe o no tienes permiso");
  return expense;
}

function checkReceipt(receipt: string | null): string | null {
  if (!receipt) return null;
  const parsed = parseReceiptDataUrl(receipt);
  if (!parsed) throw new Error("El comprobante no es válido");
  if (parsed.bytes > MOCK_RECEIPT_MAX_BYTES) throw new Error("El comprobante pesa demasiado");
  return receipt;
}

export const expenseService: ExpenseService = scoped<ExpenseService>({
  async list() {
    requireStudioAccess();
    return delay(getDb().expenses);
  },
  async listVotes(expenseId) {
    requireStudioAccess();
    return delay(getDb().expenseVotes.filter((vote) => vote.expenseId === expenseId));
  },
  async listRecurring() {
    requireStudioAccess();
    return delay(getDb().recurringExpenses);
  },
  async getReceiptUrl(expenseId) {
    requireStudioAccess();
    return delay(findExpense(expenseId).receiptUrl);
  },
  async create(input) {
    const userId = currentUserId();
    const db = getDb();
    const concept = input.concept.trim();
    if (!(input.amount > 0)) throw new Error("El monto debe ser mayor a cero");
    if (!concept) throw new Error("Escribe el concepto del gasto");
    const receiptUrl = checkReceipt(input.receiptUrl);
    const draft = { amount: input.amount, currency: input.currency, status: "pending" } as const;
    const expense: Expense = {
      id: `e-${crypto.randomUUID()}`,
      paidBy: userId,
      amount: input.amount,
      currency: input.currency,
      concept,
      category: input.category,
      receiptUrl,
      // Sin votos: hasta el límite (en soles) queda aprobado; lo demás espera sus 3 votos a favor.
      status: resolveExpenseStatus(draft, [], db.settings),
      reimbursed: false,
      beforeSigning: input.beforeSigning ?? false,
      createdAt: new Date().toISOString(),
      voidReason: null,
    };
    db.expenses.push(expense);
    save();
    return delay(expense);
  },
  async vote(expenseId, inFavor) {
    const userId = currentUserId();
    const db = getDb();
    const expense = findExpense(expenseId);
    if (expense.status !== "pending") throw new Error("Este gasto ya no admite votos");
    if (db.expenseVotes.some((v) => v.expenseId === expenseId && v.userId === userId))
      throw new Error("Ya votaste en este gasto");
    db.expenseVotes.push({ expenseId, userId, inFavor });
    const votes = db.expenseVotes.filter((v) => v.expenseId === expenseId);
    const voters = db.profiles.filter(
      (p) => p.active && (p.role === "admin" || p.role === "partner"),
    ).length;
    expense.status = resolveExpenseStatus(expense, votes, db.settings, voters);
    save();
    return delay(expense);
  },
  async void(id, reason) {
    const userId = currentUserId();
    const expense = findExpense(id);
    if (expense.status === "voided") throw new Error("El gasto ya está anulado");
    if (expense.paidBy !== userId) throw new Error("Solo quien pagó el gasto puede anularlo");
    const clean = reason.trim();
    if (clean.length < 3) throw new Error("Escribe el motivo de la anulación");
    expense.status = "voided";
    expense.voidReason = clean;
    save();
    return delay(expense);
  },
});
