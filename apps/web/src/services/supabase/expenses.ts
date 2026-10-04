import type { ExpenseService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { unwrap } from "./errors";
import { mapExpense, mapRecurring, mapVote } from "./mappers";
import { requireStudioAccess } from "./session";

/**
 * Gastos, votos y recurrentes: solo socios y administradores (RLS). El estado lo fija la base:
 * hasta el límite se aprueba solo; por encima queda pendiente hasta 3 votos a favor.
 */
export function createExpenseService(client: VexaSupabase): ExpenseService {
  return {
    async list() {
      await requireStudioAccess(client);
      const rows = unwrap(
        await client.from("expenses").select("*").order("created_at").order("id"),
      );
      return rows.map(mapExpense);
    },
    async listVotes(expenseId) {
      await requireStudioAccess(client);
      const rows = unwrap(
        await client
          .from("expense_votes")
          .select("*")
          .eq("expense_id", expenseId)
          .order("created_at"),
      );
      return rows.map(mapVote);
    },
    async listRecurring() {
      await requireStudioAccess(client);
      const rows = unwrap(
        await client.from("recurring_expenses").select("*").order("next_date").order("id"),
      );
      return rows.map(mapRecurring);
    },
    async create(input) {
      return mapExpense(
        unwrap(
          await client.rpc("create_expense", {
            p_amount: input.amount,
            p_currency: input.currency,
            p_concept: input.concept,
            p_category: input.category,
            p_receipt_url: input.receiptUrl ?? undefined,
            p_before_signing: input.beforeSigning ?? false,
          }),
        ),
      );
    },
    async vote(expenseId, inFavor) {
      return mapExpense(
        unwrap(
          await client.rpc("vote_expense", {
            p_expense: expenseId,
            p_in_favor: inFavor,
          }),
        ),
      );
    },
    async void(id, reason) {
      return mapExpense(
        unwrap(await client.rpc("void_expense", { p_id: id, p_reason: reason })),
      );
    },
  };
}
