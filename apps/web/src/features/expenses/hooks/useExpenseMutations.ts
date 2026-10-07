import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Expense, ExpenseVote } from "@vexa/domain/types";
import { services } from "@/services";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { isSupabaseSource } from "@/services/supabase/data-source";
import {
  buildExpenseInput,
  canCreateExpense,
  canVoteExpense,
  canVoidExpense,
  expenseErrorMessage,
  validateVoidReason,
  type ExpenseDraft,
} from "../expense-actions";

export type ExpenseAction =
  | { kind: "create"; draft: ExpenseDraft }
  | { kind: "vote"; expense: Expense; votes: ExpenseVote[]; inFavor: boolean }
  | { kind: "void"; expense: Expense; reason: string };

export function useExpenseMutations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const locked = useRef(false);
  const mutation = useMutation({
    mutationFn: async (action: ExpenseAction) => {
      if (action.kind === "create") {
        if (!canCreateExpense(user))
          throw new Error("No tienes permiso para registrar gastos.");
        return services.expenses.create(
          buildExpenseInput(
            action.draft,
            isSupabaseSource() ? "supabase" : "mock",
          ),
        );
      }
      if (action.kind === "vote") {
        if (!canVoteExpense(user, action.expense, action.votes))
          throw new Error("Este gasto no admite tu voto.");
        return services.expenses.vote(action.expense.id, action.inFavor);
      }
      if (!canVoidExpense(user, action.expense))
        throw new Error("Solo quien pagó el gasto puede anularlo.");
      return services.expenses.void(
        action.expense.id,
        validateVoidReason(action.reason),
      );
    },
    onSuccess: async (_expense, action) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "points"] }),
      ]);
      toast.success(
        action.kind === "create"
          ? "Gasto registrado"
          : action.kind === "vote"
            ? "Voto registrado"
            : "Gasto anulado",
      );
    },
    onError: (error) => toast.error(expenseErrorMessage(error)),
  });
  async function execute(action: ExpenseAction) {
    if (locked.current)
      throw new Error("Espera a que termine el cambio en curso.");
    locked.current = true;
    try {
      return await mutation.mutateAsync(action);
    } finally {
      locked.current = false;
    }
  }
  return { ...mutation, execute };
}
