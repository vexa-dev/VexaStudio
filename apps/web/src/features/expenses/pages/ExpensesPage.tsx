/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Las barras y votos reciben foco para consultar sus tooltips con teclado. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  CloudUpload,
  Plus,
  Receipt,
  Repeat2,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { todayLima, formatIsoDate, formatDateTime } from "@vexa/domain/dates";
import { formatMoney } from "@vexa/domain/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field, TextareaField } from "@/components/ui/Field";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { DatePicker } from "@/features/time/components/TimePickers";
import {
  FINANCE_KEY,
  type Reviewer,
  categories,
  frequencies,
  readFinance,
  castVote,
  contribution,
  nameOf as reviewerName,
  type FinanceStore,
  type Currency,
  type Proposal,
  type Payment,
  type Subscription,
  type Status,
  type Frequency,
} from "../finance-store";
import { useMembers } from "@/features/team/hooks/useMembers";
import "./expenses.css";

type Tab = "overview" | "proposals" | "subscriptions" | "payments" | "incomes";
type FormKind = "proposal" | "subscription" | "payment" | "income";
const labels = {
  pending: "Por aprobar",
  approved: "Aprobado",
  rejected: "Rechazado",
};
const tabs: { id: Tab; label: string; icon: typeof Wallet }[] = [
  { id: "overview", label: "Resumen", icon: Wallet },
  { id: "proposals", label: "Propuestas", icon: ShieldCheck },
  { id: "subscriptions", label: "Suscripciones", icon: Repeat2 },
  { id: "payments", label: "Pagos e historial", icon: Receipt },
  { id: "incomes", label: "Ingresos", icon: ArrowDownLeft },
];
function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      tone={
        status === "approved"
          ? "success"
          : status === "pending"
            ? "warning"
            : "danger"
      }
    >
      {labels[status]}
    </Badge>
  );
}
function Votes({
  item,
  required,
  detailed = false,
  reviewers,
}: {
  item: Proposal | Payment;
  required: number;
  detailed?: boolean;
  reviewers: Reviewer[];
}) {
  if (detailed)
    return (
      <div className="finance-reviewers">
        <div className="finance-reviewers-heading">
          <span>Revisión del equipo</span>
          <strong>
            {item.votes.filter((v) => v.favor).length}/{required} aprobaciones
          </strong>
        </div>
        <div className="finance-reviewers-grid">
          {reviewers.map((r) => {
            const vote = item.votes.find((v) => v.user === r.id);
            const status = vote
              ? vote.favor
                ? "Aprobó"
                : "Rechazó"
              : item.status === "pending"
                ? "Pendiente"
                : "Sin voto";
            return (
              <div
                key={r.id}
                className={`finance-reviewer ${vote ? (vote.favor ? "approved" : "rejected") : ""}`}
              >
                <span className="finance-reviewer-avatar">{r.initials}</span>
                <span className="finance-reviewer-name">{r.name}</span>
                <span className="finance-reviewer-status">
                  {vote ? (
                    vote.favor ? (
                      <Check size={12} aria-hidden="true" />
                    ) : (
                      <X size={12} aria-hidden="true" />
                    )
                  ) : (
                    <span className="finance-reviewer-dot" />
                  )}
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  return (
    <div className="finance-votes">
      <div className="finance-vote-people">
        {reviewers.map((r) => {
          const vote = item.votes.find((v) => v.user === r.id);
          return (
            <span
              key={r.id}
              className={vote ? (vote.favor ? "yes" : "no") : ""}
              data-tooltip={`${r.name}: ${vote ? (vote.favor ? "aprobó" : "rechazó") : "sin voto"}`}
              tabIndex={0}
            >
              {vote ? (
                vote.favor ? (
                  <Check size={12} />
                ) : (
                  <X size={12} />
                )
              ) : (
                r.initials
              )}
            </span>
          );
        })}
      </div>
      <span>
        {item.votes.filter((v) => v.favor).length}/{required} aprobaciones
      </span>
    </div>
  );
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [store, setStore] = useState(readFinance);
  const {
    data: members = [],
    isPending: membersPending,
    error: membersError,
  } = useMembers();
  const reviewers: Reviewer[] = members
    .filter((m) => m.active && (m.role === "admin" || m.role === "partner"))
    .map((m) => ({
      id: m.id,
      name: m.name,
      initials: m.name
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    }));
  const reviewer = user?.id ?? "";
  const nameOf = (id: string) => reviewerName(id, reviewers);
  const [currency, setCurrency] = useState<Currency>("PEN");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(10);
  const [incomePage, setIncomePage] = useState(1);
  const [incomePageSize, setIncomePageSize] = useState(10);
  const [incomeDetailId, setIncomeDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<FormKind | null>(null);
  const [source, setSource] = useState<Proposal | Subscription | null>(null);
  const [detail, setDetail] = useState<{
    kind: "proposal" | "payment";
    id: string;
  } | null>(null);
  const [period, setPeriod] = useState("all");
  const tab = tabs.some((t) => t.id === params.get("tab"))
    ? (params.get("tab") as Tab)
    : params.get("filter") === "pending"
      ? "proposals"
      : "overview";
  const effectiveFilter =
    params.get("filter") === "pending" ? "pending" : filter;
  const selected = detail
    ? (detail.kind === "proposal" ? store.proposals : store.payments).find(
        (p) => p.id === detail.id,
      )
    : undefined;
  useEffect(() => {
    setStore(readFinance());
    const sync = (event: StorageEvent) => {
      if (event.key === FINANCE_KEY) setStore(readFinance());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    setPaymentPage(1);
  }, [search, effectiveFilter, paymentPageSize]);
  useEffect(() => {
    setIncomePage(1);
  }, [search, incomePageSize]);
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  if (membersPending)
    return (
      <p className="finance-empty" role="status">
        Cargando integrantes…
      </p>
    );
  if (membersError)
    return (
      <p className="finance-empty" role="alert">
        No se pudieron cargar los integrantes. Intenta nuevamente.
      </p>
    );
  function commit(next: FinanceStore) {
    try {
      localStorage.setItem(FINANCE_KEY, JSON.stringify(next));
    } catch {
      toast.error(
        "No se pudo guardar el registro. Libera espacio en el navegador e intenta nuevamente.",
      );
      return false;
    }
    setStore(next);
    return true;
  }
  function switchTab(id: Tab) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    next.delete("filter");
    setParams(next, { replace: true });
    setFilter("all");
    setSearch("");
  }
  function openForm(
    kind: FormKind,
    entry: Proposal | Subscription | null = null,
  ) {
    setSource(entry);
    setForm(kind);
  }
  function vote(favor: boolean) {
    if (!detail || !selected) return;
    try {
      if (
        commit(
          castVote(store, detail.kind, selected.id, reviewer, favor, reviewers),
        )
      )
        toast.success("Decisión registrada");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  const pending =
    store.proposals.filter((p) => p.status === "pending").length +
    store.payments.filter((p) => p.status === "pending").length;
  const matchesPeriod = (date: string) =>
    period === "all" || date.startsWith(todayLima().slice(0, 7));
  const paid = store.payments.filter(
    (p) =>
      p.status === "approved" &&
      p.currency === currency &&
      matchesPeriod(p.date),
  );
  const incomes = store.incomes.filter(
    (i) => i.currency === currency && matchesPeriod(i.date),
  );
  const spent = paid.reduce((sum, p) => sum + p.amount, 0);
  const received = incomes.reduce((sum, i) => sum + i.amount, 0);
  const money = (amount: number, curr = currency) => formatMoney(amount, curr);
  const visible = (item: { title: string; status?: Status }) =>
    item.title.toLowerCase().includes(search.toLowerCase()) &&
    (effectiveFilter === "all" || item.status === effectiveFilter);
  const filteredPayments = store.payments
    .filter(visible)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const paymentPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / paymentPageSize),
  );
  const currentPaymentPage = Math.min(paymentPage, paymentPages);
  const paymentStart = (currentPaymentPage - 1) * paymentPageSize;
  const displayedPayments = filteredPayments.slice(
    paymentStart,
    paymentStart + paymentPageSize,
  );
  const selectedIncome = store.incomes.find((i) => i.id === incomeDetailId);
  const filteredIncomes = store.incomes
    .filter(visible)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const incomePages = Math.max(
    1,
    Math.ceil(filteredIncomes.length / incomePageSize),
  );
  const currentIncomePage = Math.min(incomePage, incomePages);
  const incomeStart = (currentIncomePage - 1) * incomePageSize;
  const displayedIncomes = filteredIncomes.slice(
    incomeStart,
    incomeStart + incomePageSize,
  );
  const upcoming = store.subscriptions
    .filter((s) => s.active)
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthStart = new Date(`${todayLima().slice(0, 7)}-01T12:00:00Z`);
  const chartMonths = period === "month" ? 1 : 6;
  const months = Array.from({ length: chartMonths }, (_, index) => {
    const date = new Date(monthStart);
    date.setUTCMonth(date.getUTCMonth() - chartMonths + 1 + index);
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: date.toLocaleDateString("es-PE", {
        month: "short",
        timeZone: "UTC",
      }),
      income: incomes
        .filter((i) => i.date.startsWith(key))
        .reduce((s, i) => s + i.amount, 0),
      expense: paid
        .filter((p) => p.date.startsWith(key))
        .reduce((s, p) => s + p.amount, 0),
    };
  });
  const rawMax = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const magnitude = 10 ** Math.floor(Math.log10(rawMax / 4));
  const step =
    [1, 2, 2.5, 5, 10].find((n) => n * magnitude >= rawMax / 4)! * magnitude;
  const maxChart = step * 4;
  const axisNumber = new Intl.NumberFormat("es-PE", {
    maximumFractionDigits: 1,
    notation: "compact",
  });
  const paymentExists = (s: Subscription) =>
    store.payments.some(
      (p) =>
        p.subscriptionId === s.id &&
        p.period === s.date &&
        p.status !== "rejected" &&
        (!s.split || p.payer === reviewer),
    );
  const cannotVote = selected
    ? selected.votes.some((v) => v.user === reviewer) ||
      ("payer" in selected && selected.payer === reviewer)
    : true;
  return (
    <div className="finance-workspace">
      <PageHeader
        title="Gastos"
        description="Las cuentas claras. Las decisiones, compartidas."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openForm("income")}>
              <ArrowDownLeft size={16} /> Registrar ingreso
            </Button>
            <Button onClick={() => openForm("proposal")}>
              <Plus size={17} /> Nueva propuesta
            </Button>
          </div>
        }
      />
      <nav className="finance-nav" aria-label="Secciones de gastos">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => switchTab(t.id)}
          >
            <t.icon size={16} />
            {t.label}
            {t.id === "proposals" && (
              <span>
                {store.proposals.filter((p) => p.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </nav>
      {tab === "overview" ? (
        <>
          <div className="finance-section-heading">
            <div>
              <span className="eyebrow">PULSO DEL ESTUDIO</span>
              <h2>Una mirada a las cuentas</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ChoicePicker
                label="Moneda del resumen"
                hideLabel
                value={currency}
                onChange={(v) => setCurrency(v as Currency)}
                options={[
                  { value: "PEN", label: "Soles · PEN" },
                  { value: "USD", label: "Dólares · USD" },
                ]}
              />
              <ChoicePicker
                label="Periodo del resumen"
                hideLabel
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "all", label: "Todo el historial" },
                  { value: "month", label: "Este mes" },
                ]}
              />
            </div>
          </div>
          <div className="finance-stats">
            <Card className="finance-balance">
              <span className="finance-stat-label">
                <Wallet size={16} /> Saldo registrado
              </span>
              <strong className="num">{money(received - spent)}</strong>
              <span>Ingresos menos pagos validados</span>
            </Card>
            <Card>
              <span className="finance-stat-label">
                <ArrowUpRight size={16} /> Total gastado
              </span>
              <strong className="num">{money(spent)}</strong>
              <span>{paid.length} pagos validados</span>
            </Card>
            <Card>
              <span className="finance-stat-label">
                <ArrowDownLeft size={16} /> Ingresos
              </span>
              <strong className="num">{money(received)}</strong>
              <span>{incomes.length} ingresos registrados</span>
            </Card>
            <Card>
              <span className="finance-stat-label">
                <Clock3 size={16} /> Por revisar
              </span>
              <strong className="num">
                {pending}
                <small> solicitudes</small>
              </strong>
              <div className="flex gap-3">
                <button
                  className="finance-link"
                  onClick={() => switchTab("proposals")}
                >
                  Propuestas
                </button>
                <button
                  className="finance-link"
                  onClick={() => {
                    switchTab("payments");
                    setFilter("pending");
                  }}
                >
                  Pagos <ChevronRight size={14} />
                </button>
              </div>
            </Card>
          </div>
          <div className="finance-chart-grid">
            <Card>
              <div className="finance-section-heading">
                <div>
                  <span className="eyebrow">FLUJO DE CAJA</span>
                  <h2>Ingresos y gastos</h2>
                </div>
                <div className="finance-legend">
                  <span>
                    <i className="income" /> Ingresos
                  </span>
                  <span>
                    <i className="expense" /> Gastos
                  </span>
                </div>
              </div>
              <figure
                className="finance-chart"
                aria-label={`Ingresos y gastos en ${currency}`}
              >
                <figcaption className="sr-only">
                  {months
                    .map(
                      (m) =>
                        `${m.label}: ingresos ${money(m.income)}, gastos ${money(m.expense)}`,
                    )
                    .join(". ")}
                </figcaption>
                <div className="finance-chart-axis" aria-hidden="true">
                  {[4, 3, 2, 1, 0].map((i) => (
                    <span key={i} style={{ top: `${(4 - i) * 25}%` }}>
                      {axisNumber.format(step * i)}
                    </span>
                  ))}
                </div>
                <div className="finance-chart-plot">
                  {months.every((m) => !m.income && !m.expense) && (
                    <p className="finance-chart-empty">
                      Sin movimientos en este periodo
                    </p>
                  )}
                  <div className="finance-chart-lines" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} />
                    ))}
                  </div>
                  <div
                    className={`finance-chart-columns${chartMonths === 1 ? " single" : ""}`}
                  >
                    {months.map((m) => (
                      <div
                        className="finance-chart-month"
                        key={m.key}
                        tabIndex={0}
                        data-tooltip={`${m.label.toUpperCase()} · ${currency}\nIngresos: ${money(m.income)}\nGastos: ${money(m.expense)}`}
                      >
                        <div className="finance-bars">
                          <div
                            className="income"
                            style={{
                              height: `${(m.income / maxChart) * 100}%`,
                            }}
                            data-tooltip={`${m.label.toUpperCase()} · ${currency}\nIngresos: ${money(m.income)}`}
                          >
                            {m.income > 0 && (
                              <span className="finance-bar-value">
                                {axisNumber.format(m.income)}
                              </span>
                            )}
                          </div>
                          <div
                            className="expense"
                            style={{
                              height: `${(m.expense / maxChart) * 100}%`,
                            }}
                            data-tooltip={`${m.label.toUpperCase()} · ${currency}\nGastos: ${money(m.expense)}`}
                          >
                            {m.expense > 0 && (
                              <span className="finance-bar-value">
                                {axisNumber.format(m.expense)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={
                            m.key === todayLima().slice(0, 7)
                              ? "current"
                              : undefined
                          }
                        >
                          {m.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </figure>
              <p className="finance-caption">
                Solo pagos validados · {currency} ·{" "}
                {period === "month"
                  ? "Filtro de este mes aplicado"
                  : "Últimos 6 meses"}
              </p>
            </Card>
            <Card>
              <span className="eyebrow">DISTRIBUCIÓN DEL GASTO</span>
              <h2 className="mt-2 mb-6">¿En qué invertimos?</h2>
              <div className="finance-categories">
                {categories.map((category) => {
                  const sum = paid
                    .filter((p) => p.category === category)
                    .reduce((s, p) => s + p.amount, 0);
                  return (
                    <div key={category}>
                      <div>
                        <span>{category}</span>
                        <strong className="num">{money(sum)}</strong>
                      </div>
                      <div className="finance-track">
                        <span
                          style={{
                            width: `${spent ? (sum / spent) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <div className="finance-chart-grid">
            <Card>
              <div className="finance-section-heading">
                <h2>Decisiones pendientes</h2>
                <button
                  className="finance-link"
                  onClick={() => switchTab("proposals")}
                >
                  Ver todas <ChevronRight size={14} />
                </button>
              </div>
              {store.proposals
                .filter((p) => p.status === "pending")
                .slice(0, 3)
                .map((p) => (
                  <button
                    className="finance-summary-row"
                    key={p.id}
                    onClick={() => setDetail({ kind: "proposal", id: p.id })}
                  >
                    <span className="finance-item-icon">
                      <ShieldCheck size={18} />
                    </span>
                    <span>
                      <strong>{p.title}</strong>
                      <small>
                        {nameOf(p.author)} ·{" "}
                        {p.votes.filter((v) => v.favor).length}/3 aprobaciones
                      </small>
                    </span>
                    <b className="num">{money(p.amount, p.currency)}</b>
                    <ChevronRight size={16} />
                  </button>
                ))}
              {!store.proposals.some((p) => p.status === "pending") && (
                <p className="finance-empty">
                  Todo al día. No hay propuestas pendientes.
                </p>
              )}
            </Card>
            <Card>
              <div className="finance-section-heading">
                <h2>Próximos pagos</h2>
                <button
                  className="finance-link"
                  onClick={() => switchTab("subscriptions")}
                >
                  Ver suscripciones <ChevronRight size={14} />
                </button>
              </div>
              {upcoming.slice(0, 3).map((s) => (
                <button
                  className="finance-summary-row"
                  key={s.id}
                  onClick={() => switchTab("subscriptions")}
                >
                  <span className="finance-item-icon">
                    <Repeat2 size={18} />
                  </span>
                  <span>
                    <strong>{s.title}</strong>
                    <small>
                      {formatIsoDate(s.date)} · {frequencies[s.frequency]}
                    </small>
                  </span>
                  <b className="num">{money(s.amount, s.currency)}</b>
                </button>
              ))}
              {!upcoming.length && (
                <p className="finance-empty">No hay pagos programados.</p>
              )}
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="finance-section-heading">
            <div>
              <span className="eyebrow">
                {tab === "proposals"
                  ? "DECIDIMOS ENTRE TODOS"
                  : tab === "subscriptions"
                    ? "COMPROMISOS DEL ESTUDIO"
                    : tab === "payments"
                      ? "CADA PAGO, CON RESPALDO"
                      : "LO QUE ENTRA AL ESTUDIO"}
              </span>
              <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
            </div>
            <Button
              onClick={() =>
                openForm(
                  tab === "proposals"
                    ? "proposal"
                    : tab === "subscriptions"
                      ? "subscription"
                      : tab === "payments"
                        ? "payment"
                        : "income",
                )
              }
            >
              <Plus size={16} />
              {tab === "proposals"
                ? "Crear propuesta"
                : tab === "subscriptions"
                  ? "Agregar suscripción"
                  : tab === "payments"
                    ? "Registrar pago"
                    : "Registrar ingreso"}
            </Button>
          </div>
          <div className="finance-toolbar">
            <label className="finance-search vexa-search">
              <Search size={17} />
              <input
                aria-label="Buscar movimientos"
                placeholder="Buscar por concepto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {(tab === "proposals" || tab === "payments") && (
              <ChoicePicker
                label="Estado"
                hideLabel
                value={effectiveFilter}
                onChange={(v) => {
                  setFilter(v);
                  const next = new URLSearchParams(params);
                  next.delete("filter");
                  setParams(next, { replace: true });
                }}
                options={[
                  { value: "all", label: "Todos los estados" },
                  ...Object.entries(labels).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
            )}
          </div>
          {tab === "proposals" && (
            <>
              <div className="finance-proposal-grid finance-proposals">
                {store.proposals.filter(visible).map((p) => (
                  <Card key={p.id} className="finance-proposal-card">
                    <div className="finance-section-heading">
                      <Badge>{p.category}</Badge>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="finance-proposal-title-row">
                      <h3>{p.title}</h3>
                      <strong className="finance-proposal-amount num">
                        {money(p.amount, p.currency)}
                      </strong>
                    </div>
                    <p className="finance-description">{p.description}</p>
                    <div className="finance-proposal-meta">
                      <span>
                        {nameOf(p.author)}{" "}
                        <span>· {formatIsoDate(p.date)}</span>
                      </span>
                      <span>
                        {p.frequency === "once"
                          ? "Pago único"
                          : frequencies[p.frequency]}
                      </span>
                    </div>
                    <p className="finance-sharing-summary">
                      {p.split === false
                        ? "Sin dividir · pago completo"
                        : `Entre los 4 socios · tu aporte ${money(contribution(p, reviewer, reviewers), p.currency)}`}
                    </p>
                    <Votes
                      reviewers={reviewers}
                      item={p}
                      required={3}
                      detailed
                    />
                    <div className="finance-card-footer">
                      <button
                        className="finance-link"
                        onClick={() =>
                          setDetail({ kind: "proposal", id: p.id })
                        }
                      >
                        Ver propuesta <ChevronRight size={14} />
                      </button>
                      {p.status === "pending" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setDetail({ kind: "proposal", id: p.id })
                          }
                        >
                          Revisar
                        </Button>
                      )}
                      {p.status === "approved" && p.frequency === "once" && (
                        <Button
                          size="sm"
                          disabled={store.payments.some(
                            (pay) =>
                              pay.proposalId === p.id &&
                              pay.status !== "rejected" &&
                              (p.split === false || pay.payer === reviewer),
                          )}
                          onClick={() => openForm("payment", p)}
                        >
                          Registrar {p.split === false ? "pago" : "mi aporte"}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              {!store.proposals.filter(visible).length && (
                <p className="finance-empty">
                  No hay propuestas con estos filtros.
                </p>
              )}
            </>
          )}
          {tab === "subscriptions" && (
            <>
              <div className="finance-proposal-grid finance-subscriptions">
                {store.subscriptions.filter(visible).map((s) => (
                  <Card key={s.id} className="finance-subscription-card">
                    <div className="finance-section-heading">
                      <span className="finance-subscription-category">
                        <Repeat2 size={14} />
                        {s.category}
                      </span>
                      <Badge tone={s.active ? "success" : "neutral"}>
                        {s.active ? "Activa" : "Pausada"}
                      </Badge>
                    </div>
                    <div className="finance-proposal-title-row">
                      <h3>{s.title}</h3>
                      <strong className="finance-proposal-amount num">
                        {money(s.amount, s.currency)}
                        <small> / ciclo</small>
                      </strong>
                    </div>
                    <div className="finance-subscription-meta">
                      <span>{frequencies[s.frequency]}</span>
                      <span>
                        Vence {formatIsoDate(s.date)}
                        {s.date < todayLima() && s.active ? " · Vencido" : ""}
                      </span>
                    </div>
                    <div className="finance-destination">
                      <span>Depositar a {s.holder}</span>
                      <strong>{s.destination}</strong>
                    </div>
                    <div className="finance-subscription-contribution-heading">
                      <span>
                        {s.split ? "Aportes del equipo" : "Pago del ciclo"}
                      </span>
                      <span>
                        {s.split ? "Entre los 4 socios" : "Sin dividir"}
                      </span>
                    </div>
                    <div
                      className={`finance-contributions ${s.split ? "split" : "single"}`}
                    >
                      {(s.split
                        ? reviewers
                        : reviewers.filter((r) => r.id === reviewer)
                      ).map((r) => {
                        const payment = store.payments.find(
                          (p) =>
                            p.subscriptionId === s.id &&
                            p.period === s.date &&
                            (!s.split || p.payer === r.id) &&
                            p.status !== "rejected",
                        );
                        return (
                          <div key={r.id}>
                            <span>{s.split ? r.name : "Pago completo"}</span>
                            <strong className="num">
                              {money(
                                contribution(s, r.id, reviewers),
                                s.currency,
                              )}
                            </strong>
                            <Badge
                              tone={
                                payment?.status === "approved"
                                  ? "success"
                                  : payment
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {payment?.status === "approved"
                                ? "Validado"
                                : payment
                                  ? "Por aprobar"
                                  : "Sin pagar"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                    <div className="finance-card-footer">
                      <button
                        className="finance-link"
                        onClick={() =>
                          commit({
                            ...store,
                            subscriptions: store.subscriptions.map((sub) =>
                              sub.id === s.id
                                ? { ...sub, active: !sub.active }
                                : sub,
                            ),
                          })
                        }
                      >
                        {s.active ? "Pausar" : "Reactivar"}
                      </button>
                      <Button
                        size="sm"
                        disabled={!s.active || paymentExists(s)}
                        onClick={() => openForm("payment", s)}
                      >
                        Registrar {s.split ? "mi aporte" : "pago"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              {!store.subscriptions.filter(visible).length && (
                <p className="finance-empty">
                  Agrega tu primera suscripción o cambia la búsqueda.
                </p>
              )}
            </>
          )}
          {tab === "payments" && (
            <>
              <Card className="finance-table-card">
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Pagado por</th>
                        <th>Importe</th>
                        <th>Destino</th>
                        <th>Comprobante</th>
                        <th>Revisión</th>
                        <th>Estado</th>
                        <th>
                          <span className="sr-only">Detalle</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPayments.map((p) => (
                        <tr
                          key={p.id}
                          className="finance-payment-row"
                          tabIndex={0}
                          aria-label={`Ver pago ${p.title}`}
                          onClick={() =>
                            setDetail({ kind: "payment", id: p.id })
                          }
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setDetail({ kind: "payment", id: p.id });
                            }
                          }}
                        >
                          <td>
                            <strong>{p.title}</strong>
                            <small>
                              {p.category} · {formatIsoDate(p.date)} ·{" "}
                              {p.subscriptionId ? "Recurrente" : "Pago único"}
                            </small>
                          </td>
                          <td>{nameOf(p.payer)}</td>
                          <td className="num">{money(p.amount, p.currency)}</td>
                          <td className="finance-payment-destination">
                            <strong>{p.holder}</strong>
                            <small>{p.destination}</small>
                          </td>
                          <td>
                            <span
                              className={
                                p.receipt
                                  ? "finance-receipt-present"
                                  : "text-muted"
                              }
                            >
                              {p.receipt ? "Adjunto" : "Sin adjunto"}
                            </span>
                            <small>
                              {p.receipt
                                ? p.receiptName
                                : "Sin comprobante registrado"}
                            </small>
                          </td>
                          <td>
                            <Votes
                              reviewers={reviewers}
                              item={p}
                              required={2}
                            />
                            <small>
                              {p.votes
                                .filter((v) => v.favor)
                                .map((v) => nameOf(v.user))
                                .join(", ") || "Pendiente de revisión"}
                            </small>
                          </td>
                          <td>
                            <StatusBadge status={p.status} />
                          </td>
                          <td>
                            <button
                              aria-label={`Ver pago ${p.title}`}
                              className="finance-detail-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDetail({ kind: "payment", id: p.id });
                              }}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredPayments.length && (
                  <p className="finance-empty">
                    No hay pagos con estos filtros.
                  </p>
                )}
                <div className="finance-pagination">
                  <div className="finance-pagination-size">
                    <span>Mostrar</span>
                    <ChoicePicker
                      label="Registros por página"
                      hideLabel
                      value={String(paymentPageSize)}
                      onChange={(value) => setPaymentPageSize(Number(value))}
                      options={[10, 20, 50].map((value) => ({
                        value: String(value),
                        label: String(value),
                      }))}
                    />
                    <span>por página</span>
                  </div>
                  <span className="finance-pagination-count">
                    {filteredPayments.length ? paymentStart + 1 : 0}–
                    {Math.min(
                      paymentStart + paymentPageSize,
                      filteredPayments.length,
                    )}{" "}
                    de {filteredPayments.length} pagos
                  </span>
                  <div className="finance-pagination-controls">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPaymentPage === 1}
                      onClick={() => setPaymentPage(currentPaymentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <span>
                      {currentPaymentPage} / {paymentPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPaymentPage === paymentPages}
                      onClick={() => setPaymentPage(currentPaymentPage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          )}
          {tab === "incomes" && (
            <>
              <Card className="finance-table-card">
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Origen</th>
                        <th>Cuenta de ingreso</th>
                        <th>Comprobante</th>
                        <th>Registrado por</th>
                        <th>Moneda</th>
                        <th className="finance-income-amount">Importe</th>
                        <th>
                          <span className="sr-only">Detalle</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedIncomes.map((i) => (
                        <tr
                          key={i.id}
                          className="finance-payment-row"
                          tabIndex={0}
                          aria-label={`Ver ingreso ${i.title}`}
                          onClick={() => setIncomeDetailId(i.id)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setIncomeDetailId(i.id);
                            }
                          }}
                        >
                          <td>
                            <strong>{i.title}</strong>
                            <small>{formatIsoDate(i.date)}</small>
                          </td>
                          <td>{i.source}</td>
                          <td className="finance-payment-destination">
                            <strong>
                              {i.holder || "Sin titular registrado"}
                            </strong>
                            <small>
                              {i.destination || "Sin cuenta registrada"}
                            </small>
                          </td>
                          <td>
                            <span
                              className={
                                i.receipt
                                  ? "finance-receipt-present"
                                  : "text-muted"
                              }
                            >
                              {i.receipt ? "Adjunto" : "Sin adjunto"}
                            </span>
                          </td>

                          <td>
                            <span className="finance-income-author">
                              <span
                                className="finance-income-avatar"
                                aria-hidden="true"
                              >
                                {reviewers.find((r) => r.id === i.author)
                                  ?.initials ?? "–"}
                              </span>
                              {nameOf(i.author)}
                            </span>
                          </td>
                          <td>{i.currency}</td>
                          <td className="num text-success finance-income-amount">
                            + {money(i.amount, i.currency)}
                          </td>
                          <td>
                            <button
                              className="finance-detail-button"
                              aria-label={`Ver ingreso ${i.title}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setIncomeDetailId(i.id);
                              }}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredIncomes.length && (
                  <p className="finance-empty">
                    Aún no hay ingresos con esta búsqueda.
                  </p>
                )}
                <div className="finance-pagination">
                  <div className="finance-pagination-size">
                    <span>Mostrar</span>
                    <ChoicePicker
                      label="Registros por página"
                      hideLabel
                      value={String(incomePageSize)}
                      onChange={(value) => setIncomePageSize(Number(value))}
                      options={[10, 20, 50].map((value) => ({
                        value: String(value),
                        label: String(value),
                      }))}
                    />
                    <span>por página</span>
                  </div>
                  <span className="finance-pagination-count">
                    {filteredIncomes.length ? incomeStart + 1 : 0}–
                    {Math.min(
                      incomeStart + incomePageSize,
                      filteredIncomes.length,
                    )}{" "}
                    de {filteredIncomes.length} ingresos
                  </span>
                  <div className="finance-pagination-controls">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentIncomePage === 1}
                      onClick={() => setIncomePage(currentIncomePage - 1)}
                    >
                      Anterior
                    </Button>
                    <span>
                      {currentIncomePage} / {incomePages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentIncomePage === incomePages}
                      onClick={() => setIncomePage(currentIncomePage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}
      {tab !== "proposals" &&
        tab !== "subscriptions" &&
        tab !== "payments" &&
        tab !== "incomes" && (
          <p className="finance-footnote">
            Propuestas: 3 votos · Comprobantes: 2 revisores externos al pago ·
            PEN y USD separados
          </p>
        )}
      <Sheet
        open={Boolean(selectedIncome)}
        onClose={() => setIncomeDetailId(null)}
        title={selectedIncome?.title ?? "Detalle del ingreso"}
        description="Ingreso registrado"
      >
        {selectedIncome && (
          <div className="finance-detail">
            <strong className="finance-proposal-amount num text-success">
              + {money(selectedIncome.amount, selectedIncome.currency)}
            </strong>
            <dl className="detail-list">
              <div>
                <dt>Origen</dt>
                <dd>{selectedIncome.source}</dd>
              </div>
              <div>
                <dt>Fecha del movimiento</dt>
                <dd>{formatIsoDate(selectedIncome.date)}</dd>
              </div>
              <div>
                <dt>Registrado por</dt>
                <dd>{nameOf(selectedIncome.author)}</dd>
              </div>
              <div>
                <dt>Moneda</dt>
                <dd>
                  {selectedIncome.currency === "PEN"
                    ? "PEN · Soles"
                    : "USD · Dólares"}
                </dd>
              </div>
              <div>
                <dt>Titular de la cuenta</dt>
                <dd>{selectedIncome.holder || "Sin registrar"}</dd>
              </div>
              <div>
                <dt>Cuenta donde ingresó</dt>
                <dd>{selectedIncome.destination || "Sin registrar"}</dd>
              </div>
            </dl>
            {selectedIncome.receipt ? (
              <div className="finance-receipt">
                <a
                  href={selectedIncome.receipt}
                  download={selectedIncome.receiptName || "comprobante"}
                >
                  <img
                    src={selectedIncome.receipt}
                    alt="Comprobante del ingreso"
                  />
                  <span>Descargar comprobante</span>
                </a>
              </div>
            ) : (
              <p className="finance-caption">Sin comprobante adjunto.</p>
            )}
          </div>
        )}
      </Sheet>
      <Sheet
        open={Boolean(selected)}
        onClose={() => setDetail(null)}
        title={selected?.title ?? "Detalle"}
        description={
          detail?.kind === "proposal"
            ? "Propuesta de gasto · decisión del equipo"
            : "Comprobante de pago · revisión del equipo"
        }
      >
        {selected && (
          <div className="finance-detail">
            <div className="flex items-center justify-between gap-3">
              <strong className="finance-proposal-amount num">
                {money(selected.amount, selected.currency)}
              </strong>
              <StatusBadge status={selected.status} />
            </div>
            {"description" in selected && <p>{selected.description}</p>}
            <dl className="detail-list">
              <div>
                <dt>{"payer" in selected ? "Pagado por" : "Propuesto por"}</dt>
                <dd>
                  {nameOf(
                    "payer" in selected ? selected.payer : selected.author,
                  )}
                </dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatIsoDate(selected.date)}</dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{selected.category}</dd>
              </div>
              <div>
                <dt>Titular</dt>
                <dd>{selected.holder}</dd>
              </div>
              <div>
                <dt>Destino</dt>
                <dd>{selected.destination}</dd>
              </div>
            </dl>
            {"receipt" in selected && (
              <div className="finance-receipt">
                {selected.receipt ? (
                  <a href={selected.receipt} download={selected.receiptName}>
                    <img
                      src={selected.receipt}
                      alt={`Comprobante: ${selected.receiptName}`}
                    />
                    <span>Descargar comprobante</span>
                  </a>
                ) : (
                  <p>{selected.receiptName}</p>
                )}
              </div>
            )}
            <h3>Revisión del equipo</h3>
            <Votes
              reviewers={reviewers}
              item={selected}
              required={detail?.kind === "proposal" ? 3 : 2}
            />
            {selected.votes.map((v) => (
              <div className="finance-review-line" key={v.user}>
                <span>
                  {nameOf(v.user)}
                  <small className="block text-xs text-muted">
                    {v.at.length === 10
                      ? formatIsoDate(v.at)
                      : formatDateTime(v.at)}
                  </small>
                </span>
                <span className={v.favor ? "text-success" : "text-danger"}>
                  {v.favor ? "Aprobó" : "Rechazó"}
                </span>
              </div>
            ))}
            {selected.status === "pending" && (
              <>
                <p className="finance-caption">
                  Revisando como {nameOf(reviewer)}.{" "}
                  {"payer" in selected && selected.payer === reviewer
                    ? "Otra persona debe validar tu pago."
                    : selected.votes.some((v) => v.user === reviewer)
                      ? "Ya registraste tu decisión."
                      : "Tu voto quedará registrado en el historial."}
                </p>
                <div className="flex gap-2">
                  <Button disabled={cannotVote} onClick={() => vote(true)}>
                    <Check size={16} /> Aprobar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={cannotVote}
                    onClick={() => vote(false)}
                  >
                    <X size={16} /> Rechazar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>
      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        className={`finance-form-modal finance-form-modal--${form ?? "income"}`}
        title={
          form === "proposal"
            ? "Nueva propuesta"
            : form === "subscription"
              ? "Nueva suscripción"
              : form === "payment"
                ? "Registrar pago"
                : "Registrar ingreso"
        }
        description={`Registrando como ${user?.name ?? ""}`}
      >
        {form && (
          <FinanceForm
            key={`${form}-${source?.id ?? "new"}`}
            kind={form}
            source={source}
            reviewer={reviewer}
            reviewers={reviewers}
            store={store}
            onSave={(next) => {
              if (!commit(next)) return;
              setForm(null);
              toast.success("Registro guardado");
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function FinanceForm({
  kind,
  source,
  reviewer,
  reviewers,
  store,
  onSave,
}: {
  kind: FormKind;
  source: Proposal | Subscription | null;
  reviewer: string;
  reviewers: Reviewer[];
  store: FinanceStore;
  onSave: (next: FinanceStore) => void;
}) {
  const receiptInput = useRef<HTMLInputElement>(null);
  const [draggingReceipt, setDraggingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptSize, setReceiptSize] = useState(0);
  const [receipt, setReceipt] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [frequency, setFrequency] = useState(
    source?.frequency ?? (kind === "subscription" ? "monthly" : "once"),
  );
  const [currency, setCurrency] = useState<Currency>(source?.currency ?? "PEN");
  const [category, setCategory] = useState(source?.category ?? "Software");
  const [split, setSplit] = useState(source?.split !== false);
  const [selectedDate, setSelectedDate] = useState(
    kind === "proposal" || kind === "subscription"
      ? (source?.date ?? todayLima())
      : todayLima(),
  );
  const sub = source && "active" in source ? source : null;
  function selectReceipt(file?: File) {
    if (!file || reading) return;
    setReceiptError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    ) {
      setReceiptError("Elige una imagen JPG, PNG o WebP de hasta 2 MB.");
      return;
    }
    setReading(true);
    const reader = new FileReader();
    const fail = () => {
      setReading(false);
      setReceiptError("No se pudo leer la imagen. Selecciona otro archivo.");
    };
    reader.onerror = fail;
    reader.onload = () => {
      const result = String(reader.result);
      const image = new Image();
      image.onerror = fail;
      image.onload = () => {
        setReceipt(result);
        setReceiptName(file.name);
        setReceiptSize(file.size);
        setReading(false);
        setError("");
      };
      image.src = result;
    };
    reader.readAsDataURL(file);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const amount = Number(data.get("amount"));
    const date = String(data.get("date"));
    if (kind !== "income" && !reviewers.some((r) => r.id === reviewer)) {
      setError(
        "Tu perfil debe pertenecer al equipo de socios para registrar este gasto.",
      );
      return;
    }
    if (
      (kind === "proposal" || kind === "subscription") &&
      split &&
      reviewers.length !== 4
    ) {
      setError("Se necesitan los cuatro socios activos para dividir el gasto.");
      return;
    }
    if (
      !date ||
      ((kind === "payment" || kind === "income") && date > todayLima())
    ) {
      setError("Selecciona una fecha válida para el movimiento.");
      return;
    }
    if (
      !title ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.abs(Math.round(amount * 100) - amount * 100) > 0.00001
    ) {
      setError(
        "Escribe un concepto y un importe mayor a cero, con hasta 2 decimales.",
      );
      return;
    }
    if (kind === "payment" && !receipt) {
      setError(
        "Adjunta una imagen del comprobante para solicitar la revisión.",
      );
      return;
    }
    if (
      (kind === "subscription" || kind === "proposal") &&
      split &&
      amount < 0.04
    ) {
      setError(
        "El total debe ser al menos 0.04 para repartirlo entre los cuatro integrantes.",
      );
      return;
    }
    if (
      (kind === "income" && !String(data.get("source") ?? "").trim()) ||
      (kind === "proposal" && !String(data.get("description") ?? "").trim())
    ) {
      setError("Completa la información del registro.");
      return;
    }
    if (
      kind === "payment" &&
      source &&
      store.payments.some(
        (p) =>
          p.status !== "rejected" &&
          (sub
            ? p.subscriptionId === sub.id &&
              p.period === sub.date &&
              (!sub.split || p.payer === reviewer)
            : p.proposalId === source.id &&
              (source.split === false || p.payer === reviewer)),
      )
    ) {
      setError("Ya existe un pago pendiente o validado para este registro.");
      return;
    }
    const common = {
      id: crypto.randomUUID(),
      title,
      amount,
      currency,
      date,
      category,
      destination: String(data.get("destination") ?? "").trim(),
      holder: String(data.get("holder") ?? "").trim(),
    };
    if (!common.destination || !common.holder) {
      setError("Indica el destino y el titular del depósito.");
      return;
    }
    if (kind === "income")
      onSave({
        ...store,
        incomes: [
          {
            id: common.id,
            title,
            amount,
            currency,
            date,
            holder: common.holder,
            destination: common.destination,
            receipt,
            receiptName,
            source: String(data.get("source")).trim(),
            author: reviewer,
          },
          ...store.incomes,
        ],
      });
    else if (kind === "proposal")
      onSave({
        ...store,
        proposals: [
          {
            ...common,
            description: String(data.get("description")).trim(),
            author: reviewer,
            frequency: frequency as Frequency | "once",
            split,
            status: "pending",
            votes: [],
          },
          ...store.proposals,
        ],
      });
    else if (kind === "subscription")
      onSave({
        ...store,
        subscriptions: [
          {
            ...common,
            frequency: frequency as Frequency,
            split,
            active: true,
          },
          ...store.subscriptions,
        ],
      });
    else
      onSave({
        ...store,
        payments: [
          {
            ...common,
            payer: reviewer,
            receipt,
            receiptName,
            status: "pending",
            votes: [],
            ...(sub
              ? { subscriptionId: sub.id, period: sub.date }
              : source
                ? { proposalId: source.id }
                : {}),
          },
          ...store.payments,
        ],
      });
  }
  return (
    <form className="finance-form" onSubmit={submit}>
      {source && (
        <>
          <input type="hidden" name="title" value={source.title} />
          <input
            type="hidden"
            name="amount"
            value={contribution(source, reviewer, reviewers)}
          />
          <input type="hidden" name="holder" value={source.holder} />
          <input type="hidden" name="destination" value={source.destination} />
        </>
      )}
      {source && (
        <p className="finance-rule finance-form-wide">
          {sub
            ? `Ciclo del ${formatIsoDate(sub.date)} · ${sub.split ? "Tu aporte de 1/4 del total" : "Pago completo"}`
            : `Propuesta aprobada · ${source.split !== false ? "Tu aporte de 1/4 del total" : "Pago completo"}`}
        </p>
      )}
      <div className="finance-form-wide">
        <Field
          label="Concepto"
          name="title"
          required
          maxLength={100}
          placeholder={
            kind === "income" ? "Concepto del ingreso" : "Concepto del gasto"
          }
          defaultValue={source?.title}
          disabled={Boolean(source)}
        />
      </div>
      {kind === "proposal" && (
        <div className="finance-form-wide">
          <TextareaField
            label="¿Para qué se necesita?"
            name="description"
            required
            maxLength={1000}
            placeholder="Describe el objetivo del gasto"
          />
        </div>
      )}
      <div className="finance-form-grid finance-form-wide">
        <Field
          label={
            source?.split !== false && source
              ? "Tu aporte"
              : kind === "proposal" || kind === "subscription"
                ? "Importe total"
                : "Importe"
          }
          name="amount"
          type="number"
          required
          min="0.01"
          max="999999999"
          step="0.01"
          placeholder="0.00"
          defaultValue={
            source ? contribution(source, reviewer, reviewers) : undefined
          }
          disabled={Boolean(source)}
        />
        <ChoicePicker
          label="Moneda"
          value={currency}
          onChange={(v) => setCurrency(v as Currency)}
          disabled={Boolean(source)}
          options={[
            { value: "PEN", label: "PEN · Soles" },
            { value: "USD", label: "USD · Dólares" },
          ]}
        />
      </div>
      <DatePicker
        label={
          kind === "subscription"
            ? "Primer vencimiento"
            : kind === "proposal"
              ? "Fecha prevista"
              : "Fecha del movimiento"
        }
        value={selectedDate}
        onChange={setSelectedDate}
        allowClear={false}
        max={kind === "payment" || kind === "income" ? todayLima() : undefined}
      />
      <input type="hidden" name="date" value={selectedDate} />
      {kind === "income" && (
        <Field
          label="Origen del ingreso"
          name="source"
          required
          maxLength={150}
          placeholder="Cliente o proyecto"
        />
      )}
      {kind !== "income" && (
        <ChoicePicker
          label="Categoría"
          value={category}
          onChange={setCategory}
          disabled={Boolean(source)}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
      )}
      {(kind === "proposal" || kind === "subscription") && (
        <div className="finance-form-wide">
          <ChoicePicker
            label="Frecuencia"
            value={frequency}
            onChange={(v) => setFrequency(v as Frequency | "once")}
            options={[
              ...(kind === "proposal"
                ? [{ value: "once", label: "Pago único" }]
                : []),
              ...Object.entries(frequencies).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </div>
      )}
      <>
        <Field
          label="Titular de la cuenta"
          name="holder"
          required
          maxLength={100}
          placeholder="Nombre del titular"
          defaultValue={source?.holder}
          disabled={Boolean(source)}
        />
        <Field
          label={
            kind === "income" ? "Cuenta donde ingresó" : "Cuenta, Yape o Plin"
          }
          name="destination"
          required
          maxLength={160}
          placeholder="Cuenta o celular"
          defaultValue={source?.destination}
          disabled={Boolean(source)}
        />
      </>
      {(kind === "payment" || kind === "income") && (
        <div className="finance-form-wide">
          <span className="finance-upload-label">
            {kind === "income"
              ? "Comprobante del ingreso (opcional)"
              : "Comprobante de pago"}
          </span>
          <div
            className={`finance-upload ${draggingReceipt ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!reading) setDraggingReceipt(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDraggingReceipt(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingReceipt(false);
              if (event.dataTransfer.files.length > 1)
                setReceiptError("Adjunta un solo comprobante.");
              else selectReceipt(event.dataTransfer.files[0]);
            }}
          >
            <button
              type="button"
              className="finance-upload-trigger"
              disabled={reading}
              onClick={() => receiptInput.current?.click()}
              aria-label={
                receipt ? "Cambiar comprobante" : "Adjuntar comprobante"
              }
            >
              {!receipt && (
                <CloudUpload
                  className="finance-upload-symbol"
                  size={28}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              )}
              {receipt && (
                <img
                  className="finance-upload-thumbnail"
                  src={receipt}
                  alt="Vista previa del comprobante"
                />
              )}
              <span className="finance-upload-copy" aria-live="polite">
                <strong>
                  {reading
                    ? "Preparando imagen…"
                    : receiptName ||
                      (draggingReceipt
                        ? "Suelta tu comprobante aquí"
                        : "Haz clic o arrastra tu comprobante")}
                </strong>
                <span>
                  {receipt
                    ? `${Math.max(1, Math.round(receiptSize / 1024))} KB · Imagen adjunta`
                    : "JPG, PNG o WebP · Máximo 2 MB"}
                </span>
              </span>
            </button>
            {receipt && (
              <button
                type="button"
                className="finance-upload-remove"
                aria-label="Quitar comprobante"
                disabled={reading}
                onClick={() => {
                  setReceipt("");
                  setReceiptName("");
                  setReceiptSize(0);
                  setReceiptError("");
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
            <input
              ref={receiptInput}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-label="Seleccionar comprobante"
              disabled={reading}
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                selectReceipt(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {receiptError && (
            <p role="alert" className="finance-upload-error">
              {receiptError}
            </p>
          )}
        </div>
      )}

      {kind === "subscription" && (
        <p className="finance-caption finance-form-wide">
          Registro directo de una suscripción existente. Para proponer una nueva
          contratación, crea una propuesta recurrente (3 votos).
        </p>
      )}
      {(kind === "subscription" || kind === "proposal") && (
        <button
          type="button"
          role="switch"
          aria-checked={split}
          className="finance-sharing-switch finance-form-wide"
          onClick={() => setSplit((value) => !value)}
        >
          <span>Dividir entre los 4 socios</span>
          <span className="finance-switch-track" aria-hidden="true">
            <span />
          </span>
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger finance-form-wide">
          {error}
        </p>
      )}
      <Button type="submit" disabled={reading} className="finance-form-wide">
        {reading
          ? "Leyendo comprobante…"
          : kind === "proposal"
            ? "Enviar a votación"
            : kind === "payment"
              ? "Enviar comprobante a revisión"
              : "Guardar registro"}
      </Button>
    </form>
  );
}
