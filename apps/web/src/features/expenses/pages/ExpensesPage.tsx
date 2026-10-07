import { ArrowUpRight, Receipt, Wallet } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { useExpenseOverview } from "../hooks/useExpenseOverview";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney } from "@vexa/domain/format";
import { formatDate } from "@vexa/domain/dates";
import type { Expense, ExpenseStatus } from "@vexa/domain/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { Button } from "@/components/ui/Button";
import { useExpenseMutations } from "../hooks/useExpenseMutations";
import { CreateExpenseSheet } from "../components/CreateExpenseSheet";
import { ExpenseActions } from "../components/ExpenseActions";
import { ExpenseReceipt } from "../components/ExpenseReceipt";
import {
  canCreateExpense,
  expenseCategories,
  selectedExpense,
} from "../expense-actions";
import { ChoicePicker } from "@/components/ui/ChoicePicker";

export default function ExpensesPage() {
  const overview = useExpenseOverview();
  const { user } = useAuth();
  const mutations = useExpenseMutations();
  const [creating, setCreating] = useState(false);
  const source = isSupabaseSource() ? "supabase" : "mock";
  const members = useMembers();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = {
    ...overview.data,
    expenses: overview.data?.expenses ?? [],
    expenseVotes: overview.data?.expenseVotes ?? [],
    profiles: members.data ?? [],
  };
  const [filter, setFilter] = useState<ExpenseStatus | "all">(
    searchParams.get("filter") === "pending" ? "pending" : "all",
  );
  const selected = selectedExpense(data.expenses, searchParams.get("expense"));
  const setSelected = (expense: Expense | null) => {
    const next = new URLSearchParams(searchParams);
    if (expense) next.set("expense", expense.id);
    else next.delete("expense");
    setSearchParams(next, { replace: true });
  };
  const labels = {
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    voided: "Anulado",
  };
  const categories = expenseCategories;
  const expenses = data.expenses.filter(
    (expense) => filter === "all" || expense.status === filter,
  );
  const pending = data.expenses.filter(
    (expense) => expense.status === "pending",
  ).length;
  const votes = selected
    ? data.expenseVotes.filter((vote) => vote.expenseId === selected.id)
    : [];
  if (
    (overview.isError && !overview.data) ||
    (members.isError && !members.data)
  )
    return (
      <ErrorState
        message="No se pudo cargar el resumen de gastos."
        onRetry={() => {
          void overview.refetch();
          void members.refetch();
        }}
      />
    );
  if (overview.isLoading || members.isLoading)
    return (
      <div aria-busy="true" aria-label="Cargando gastos">
        <Skeleton className="h-40" />
        <Skeleton className="mt-4 h-80" />
      </div>
    );
  return (
    <>
      <PageHeader
        title="Gastos"
        description="Cada aporte, a la vista. Claridad para decidir en equipo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              {source === "mock" ? "Datos de ejemplo" : "Datos del estudio"}
            </Badge>
            {canCreateExpense(user) && (
              <Button
                disabled={mutations.isPending}
                onClick={() => setCreating(true)}
              >
                Registrar gasto
              </Button>
            )}
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(["PEN", "USD"] as const).map((currency) => (
          <Card key={currency}>
            <span className="eyebrow">
              APROBADOS / {currency === "PEN" ? "SOLES" : "DÓLARES"}
            </span>
            <p className="mt-3 font-display text-3xl">
              {formatMoney(
                data.expenses
                  .filter(
                    (e) => e.status === "approved" && e.currency === currency,
                  )
                  .reduce((sum, e) => sum + e.amount, 0),
                currency,
              )}
            </p>
            <p className="mt-2 text-xs text-muted">
              Cada moneda se muestra por separado.
            </p>
          </Card>
        ))}
        <Card>
          <span className="eyebrow">POR REVISAR</span>
          <p className="mt-3 font-display text-3xl">
            {pending}
            <span className="ml-2 text-sm text-muted">
              {pending === 1 ? "gasto" : "gastos"}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted">
            Decisiones compartidas por el equipo.
          </p>
        </Card>
      </div>
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Receipt size={20} /> Movimientos del estudio
          </h2>
          <ChoicePicker
            label="Filtrar gastos por estado"
            hideLabel
            value={filter}
            onChange={(value) => setFilter(value as typeof filter)}
            options={[
              { value: "all", label: "Todos los estados" },
              ...Object.entries(labels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </div>
        {expenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Sin movimientos en este estado"
            description="Prueba otro filtro para ver el resto de gastos."
          />
        ) : (
          <ul className="divide-y divide-border">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <button
                  className="expense-row"
                  onClick={() => setSelected(expense)}
                >
                  <span className="expense-icon">
                    <Receipt size={20} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block text-sm font-semibold">
                      {expense.concept}
                    </strong>
                    <span className="mt-1 block text-xs text-muted">
                      {categories[expense.category]} ·{" "}
                      {formatDate(expense.createdAt)}
                    </span>
                  </span>
                  <span className="grid justify-items-end gap-2">
                    <span className="num text-sm font-semibold">
                      {formatMoney(expense.amount, expense.currency)}
                    </span>
                    <Badge
                      tone={
                        expense.status === "approved"
                          ? "success"
                          : expense.status === "pending"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {labels[expense.status]}
                    </Badge>
                  </span>
                  <ArrowUpRight size={16} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {(overview.isError || members.isError) && (
        <div role="alert" className="mt-4 text-sm text-danger">
          No se pudo actualizar el resumen.{" "}
          <Button
            variant="ghost"
            onClick={() => {
              void overview.refetch();
              void members.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      <CreateExpenseSheet
        open={creating}
        onClose={() => setCreating(false)}
        pending={mutations.isPending}
        allowed={canCreateExpense(user)}
        source={source}
        onCreate={(draft) => mutations.execute({ kind: "create", draft })}
      />
      <Sheet
        open={Boolean(selected)}
        onClose={() => {
          if (!mutations.isPending) setSelected(null);
        }}
        title={selected?.concept ?? "Detalle del gasto"}
        description="Información del aporte al estudio"
      >
        {selected && (
          <div className="grid gap-5">
            <p className="font-display text-3xl">
              {formatMoney(selected.amount, selected.currency)}
            </p>
            <Badge
              tone={selected.status === "approved" ? "success" : "neutral"}
            >
              {labels[selected.status]}
            </Badge>
            <dl className="detail-list">
              <div>
                <dt>Pagado por</dt>
                <dd>
                  {data.profiles.find((p) => p.id === selected.paidBy)?.name}
                </dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{categories[selected.category]}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>Reembolso</dt>
                <dd>
                  {selected.reimbursed ? "Reembolsado" : "Sin reembolsar"}
                </dd>
              </div>
              <div>
                <dt>Comprobante</dt>
                <dd>
                  {selected.receiptUrl ? (
                    <ExpenseReceipt key={selected.id} expenseId={selected.id} />
                  ) : (
                    "Sin comprobante adjunto"
                  )}
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="mb-3 text-sm font-semibold">
                Revisión del equipo
              </h3>
              {votes.length ? (
                <ul className="grid gap-2">
                  {votes.map((vote) => (
                    <li
                      key={vote.userId}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span>
                        {data.profiles.find((p) => p.id === vote.userId)?.name}
                      </span>
                      <span
                        className={vote.inFavor ? "text-success" : "text-muted"}
                      >
                        {vote.inFavor ? "A favor" : "En contra"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  Todavía no hay votos en este gasto.
                </p>
              )}
            </div>
            <ExpenseActions
              key={selected.id}
              expense={selected}
              votes={votes}
              user={user}
              pending={mutations.isPending}
              onAction={mutations.execute}
            />
          </div>
        )}
      </Sheet>
    </>
  );
}
