import { useState, type FormEvent } from "react";
import type { Expense, ExpenseVote, Profile } from "@vexa/domain/types";
import { Button } from "@/components/ui/Button";
import { TextareaField } from "@/components/ui/Field";
import {
  canVoteExpense,
  canVoidExpense,
  expenseErrorMessage,
  validateVoidReason,
} from "../expense-actions";
import type { ExpenseAction } from "../hooks/useExpenseMutations";

export function ExpenseActions({
  expense,
  votes,
  user,
  pending,
  onAction,
}: {
  expense: Expense;
  votes: ExpenseVote[];
  user: Profile | null;
  pending: boolean;
  onAction: (action: ExpenseAction) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canVote = canVoteExpense(user, expense, votes);
  const canVoid = canVoidExpense(user, expense);
  const voted = votes.some((vote) => vote.userId === user?.id);
  async function run(action: ExpenseAction) {
    if (pending) return;
    setError(null);
    try {
      if (action.kind === "void") validateVoidReason(action.reason);
      await onAction(action);
      if (action.kind === "void") setReason("");
    } catch (failure) {
      setError(expenseErrorMessage(failure));
    }
  }
  function submitVoid(event: FormEvent) {
    event.preventDefault();
    void run({ kind: "void", expense, reason });
  }
  return (
    <section
      className="grid gap-4"
      aria-label="Acciones del gasto"
      aria-busy={pending}
    >
      {canVote && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canVoteExpense(user, expense, votes, pending)}
            onClick={() =>
              void run({ kind: "vote", expense, votes, inFavor: true })
            }
          >
            Votar a favor
          </Button>
          <Button
            variant="secondary"
            disabled={!canVoteExpense(user, expense, votes, pending)}
            onClick={() =>
              void run({ kind: "vote", expense, votes, inFavor: false })
            }
          >
            Votar en contra
          </Button>
        </div>
      )}
      {expense.status === "pending" && voted && (
        <p className="text-sm text-muted">
          Ya registraste tu voto en este gasto.
        </p>
      )}
      {canVoid && (
        <form onSubmit={submitVoid} className="grid gap-3">
          <TextareaField
            label="Motivo de anulación"
            hint="Al menos 3 caracteres. El gasto permanecerá en el historial."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            required
          />
          <Button
            type="submit"
            variant="danger"
            disabled={
              !canVoidExpense(user, expense, pending) ||
              reason.trim().length < 3
            }
          >
            {pending ? "Guardando…" : "Anular gasto"}
          </Button>
        </form>
      )}
      {expense.voidReason && (
        <p className="text-sm text-muted">
          Motivo de anulación: {expense.voidReason}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
