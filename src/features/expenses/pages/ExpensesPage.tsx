import { ArrowUpRight, Filter, Receipt, Wallet } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { buildSeed } from "@/services/mock/seed";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { Expense, ExpenseStatus } from "@/domain/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ExpensesPage() {
  const [data] = useState(() => buildSeed(new Date()));
  const [filter, setFilter] = useState<ExpenseStatus | "all">("all");
  const [selected, setSelected] = useState<Expense | null>(null);
  const labels = {
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    voided: "Anulado",
  };
  const categories = {
    infrastructure: "Infraestructura",
    software: "Software",
    marketing: "Marketing",
    legal: "Legal",
    other: "Otro",
  };
  const expenses = data.expenses.filter(
    (expense) => filter === "all" || expense.status === filter,
  );
  const pending = data.expenses.filter(
    (expense) => expense.status === "pending",
  ).length;
  const votes = selected
    ? data.expenseVotes.filter((vote) => vote.expenseId === selected.id)
    : [];
  return (
    <>
      <PageHeader
        title="Gastos"
        description="Cada aporte, a la vista. Claridad para decidir en equipo."
        actions={<Badge>Vista con datos de ejemplo</Badge>}
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
          <label className="flex items-center gap-2 text-sm text-muted">
            <Filter size={16} />{" "}
            <span className="sr-only">Filtrar gastos por estado</span>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as typeof filter)
              }
              className="min-h-11 border border-border px-3"
            >
              <option value="all">Todos los estados</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
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
      <p className="mt-4 text-xs text-muted">
        Vista de ejemplo: aquí puedes consultar y filtrar, sin crear gastos ni
        emitir votos.
      </p>
      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.concept ?? "Detalle del gasto"}
        description="Información simulada del aporte al estudio"
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
                  {selected.receiptUrl
                    ? "Adjunto de ejemplo"
                    : "Sin comprobante adjunto"}
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
                  Todavía no hay votos en este ejemplo.
                </p>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
