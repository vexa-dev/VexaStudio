import { seedFinance } from "./finance-sample-data";
export const FINANCE_KEY = "vexa.finance.v1";
export interface Reviewer {
  id: string;
  name: string;
  initials: string;
}
export const categories = [
  "Publicidad",
  "Software",
  "Infraestructura",
  "Operaciones",
  "Otros",
];
export const frequencies = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};
export type Frequency = keyof typeof frequencies;
export type Currency = "PEN" | "USD";
export type Status = "pending" | "approved" | "rejected";
export interface Vote {
  user: string;
  favor: boolean;
  at: string;
}
export interface Proposal {
  split?: boolean;
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: Currency;
  category: string;
  date: string;
  author: string;
  votes: Vote[];
  status: Status;
  frequency: Frequency | "once";
  destination: string;
  holder: string;
}
export interface Subscription {
  id: string;
  title: string;
  amount: number;
  currency: Currency;
  category: string;
  frequency: Frequency;
  date: string;
  destination: string;
  holder: string;
  split: boolean;
  active: boolean;
}
export interface Payment {
  id: string;
  title: string;
  amount: number;
  currency: Currency;
  category: string;
  date: string;
  payer: string;
  destination: string;
  holder: string;
  receipt: string;
  receiptName: string;
  votes: Vote[];
  status: Status;
  subscriptionId?: string;
  proposalId?: string;
  period?: string;
}
export interface Income {
  holder?: string;
  destination?: string;
  receipt?: string;
  receiptName?: string;
  id: string;
  title: string;
  amount: number;
  currency: Currency;
  date: string;
  source: string;
  author: string;
}
export interface FinanceStore {
  sharingVersion?: number;
  proposals: Proposal[];
  subscriptions: Subscription[];
  payments: Payment[];
  incomes: Income[];
}
export const nameOf = (id: string, reviewers: Reviewer[]) =>
  reviewers.find((r) => r.id === id)?.name ?? "Integrante";
export function nextDate(date: string, frequency: Frequency) {
  const value = new Date(`${date}T12:00:00Z`);
  if (frequency === "daily" || frequency === "weekly")
    value.setUTCDate(value.getUTCDate() + (frequency === "daily" ? 1 : 7));
  else {
    const day = value.getUTCDate();
    value.setUTCDate(1);
    value.setUTCMonth(value.getUTCMonth() + (frequency === "monthly" ? 1 : 12));
    const last = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0),
    ).getUTCDate();
    value.setUTCDate(Math.min(day, last));
  }
  return value.toISOString().slice(0, 10);
}
export function castVote(
  store: FinanceStore,
  kind: "proposal" | "payment",
  id: string,
  user: string,
  favor: boolean,
  reviewers: Reviewer[],
): FinanceStore {
  const next: FinanceStore = structuredClone(store);
  const item = (kind === "proposal" ? next.proposals : next.payments).find(
    (p) => p.id === id,
  );
  if (
    !reviewers.some((r) => r.id === user) ||
    !item ||
    item.status !== "pending" ||
    item.votes.some((v) => v.user === user)
  )
    throw new Error("Esta revisión ya no está disponible.");
  if ("payer" in item && item.payer === user)
    throw new Error("No puedes validar tu propio pago.");
  item.votes.push({ user, favor, at: new Date().toISOString() });
  const required = kind === "proposal" ? 3 : 2;
  if (item.votes.filter((v) => v.favor).length >= required)
    item.status = "approved";
  if (item.votes.filter((v) => !v.favor).length >= 2) item.status = "rejected";
  if (
    kind === "proposal" &&
    item.status === "approved" &&
    "frequency" in item &&
    item.frequency !== "once"
  ) {
    next.subscriptions.push({
      ...item,
      frequency: item.frequency,
      split: item.split !== false,
      active: true,
    });
  }
  if ("subscriptionId" in item && item.status === "approved") {
    const sub = next.subscriptions.find((s) => s.id === item.subscriptionId);
    if (sub && item.period === sub.date) {
      const paid = next.payments.filter(
        (p) =>
          p.subscriptionId === sub.id &&
          p.period === sub.date &&
          p.status === "approved",
      );
      if (
        !sub.split ||
        reviewers.every((r) => paid.some((p) => p.payer === r.id))
      )
        sub.date = nextDate(sub.date, sub.frequency);
    }
  }
  return next;
}
export function contribution(
  sub: { amount: number; split?: boolean },
  payer: string,
  reviewers: Reviewer[],
) {
  if (sub.split === false) return sub.amount;
  const cents = Math.round(sub.amount * 100);
  return (
    (Math.floor(cents / 4) +
      (reviewers.findIndex((r) => r.id === payer) < cents % 4 ? 1 : 0)) /
    100
  );
}
export function emptyFinance(): FinanceStore {
  return { proposals: [], subscriptions: [], payments: [], incomes: [] };
}
export function readFinance(): FinanceStore {
  const load = (key: string): FinanceStore | null => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      return raw &&
        ["proposals", "subscriptions", "payments", "incomes"].every((k) =>
          Array.isArray(raw[k]),
        )
        ? raw
        : null;
    } catch {
      return null;
    }
  };
  const current = load(FINANCE_KEY);
  const previous = load("vexa.finance-preview.v1");
  const merge = <T extends { id: string }>(saved: T[], restored: T[]): T[] => [
    ...saved,
    ...restored.filter(
      (item) => !saved.some((existing) => existing.id === item.id),
    ),
  ];
  const samples = seedFinance();
  const backup: FinanceStore = {
    proposals: merge(previous?.proposals ?? [], samples.proposals),
    subscriptions: merge(previous?.subscriptions ?? [], samples.subscriptions),
    payments: merge(previous?.payments ?? [], samples.payments),
    incomes: merge(previous?.incomes ?? [], samples.incomes),
  };
  // Conserva las decisiones y registros actuales; recupera los datos previos que faltan.
  const legacyId = (id: string) =>
    ["jhony", "rober", "jose", "diego"].includes(id) ? "u-" + id : id;
  const votes = (items: Vote[]) =>
    items.map((v) => ({ ...v, user: legacyId(v.user) }));
  return {
    proposals: merge(current?.proposals ?? [], backup.proposals).map((p) => ({
      ...p,
      author: legacyId(p.author),
      votes: votes(p.votes),
    })),
    subscriptions: merge(current?.subscriptions ?? [], backup.subscriptions),
    payments: merge(current?.payments ?? [], backup.payments).map((p) => ({
      ...p,
      payer: legacyId(p.payer),
      votes: votes(p.votes),
    })),
    incomes: merge(current?.incomes ?? [], backup.incomes).map((i) => ({
      ...i,
      author: legacyId(i.author),
    })),
  };
}
