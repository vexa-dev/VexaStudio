import { afterEach, describe, expect, it, vi } from "vitest";
import {
  castVote as vote,
  contribution as share,
  nextDate,
  readFinance,
  emptyFinance,
  type Payment,
} from "./finance-store";

import { seedFinance, reviewers } from "./finance-sample-data";
const castVote = (
  ...args: Parameters<typeof vote> extends [...infer Head, unknown]
    ? Head
    : never
) => vote(...args, reviewers);
const contribution = (
  item: { amount: number; split?: boolean },
  payer: string,
) => share(item, payer, reviewers);
describe("finance frontend", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps sample records when no saved data exists", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const store = readFinance();
    expect(store.proposals).toHaveLength(2);
    expect(store.subscriptions).toHaveLength(2);
    expect(store.payments).toHaveLength(3);
    expect(store.incomes).toHaveLength(1);
    expect(store.proposals[0]!.author).toBe("u-diego");
  });
  it("restores previous records without overwriting current edits", () => {
    const old = seedFinance();
    const income = {
      ...old.incomes[0]!,
      id: "user-income",
      title: "Ingreso registrado",
      author: "u-jhony",
    };
    const edited = { ...old.proposals[0]!, title: "Propuesta modificada" };
    vi.stubGlobal("localStorage", {
      getItem: (key: string) =>
        JSON.stringify(
          key === "vexa.finance-preview.v1"
            ? old
            : { ...emptyFinance(), proposals: [edited], incomes: [income] },
        ),
    });
    const store = readFinance();
    expect(store.proposals).toHaveLength(2);
    expect(store.proposals[0]!.title).toBe("Propuesta modificada");
    expect(store.incomes).toContainEqual(income);
    expect(store.incomes).toHaveLength(2);
    expect(store.payments[0]!.votes[0]!.user).toBe("u-rober");
  });
  it("restores samples even when both saved stores are empty", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(emptyFinance()) });
    expect(readFinance().subscriptions).toHaveLength(2);
    expect(readFinance().proposals).toHaveLength(2);
  });
  it("defaults to shared expenses and preserves an explicit opt-out when approving a recurring proposal", () => {
    let store = seedFinance();
    expect(store.subscriptions.every((s) => s.split)).toBe(true);
    store.proposals.find((p) => p.id === "demo-domain")!.split = false;
    for (const user of ["jhony", "rober", "jose"])
      store = castVote(store, "proposal", "demo-domain", user, true);
    const sub = store.subscriptions.find((s) => s.id === "demo-domain")!;
    expect(sub.split).toBe(false);
    expect(contribution(sub, "jhony")).toBe(85);
    expect(contribution({ amount: 480, split: true }, "jhony")).toBe(120);
  });
  it("requires three unique votes and creates a recurrent subscription only once", () => {
    let store = seedFinance();
    const id = "demo-domain";
    store = castVote(store, "proposal", id, "jhony", true);
    expect(() => castVote(store, "proposal", id, "jhony", true)).toThrow();
    store = castVote(store, "proposal", id, "rober", true);
    expect(store.proposals.find((p) => p.id === id)?.status).toBe("pending");
    store = castVote(store, "proposal", id, "jose", true);
    expect(store.proposals.find((p) => p.id === id)?.status).toBe("approved");
    expect(store.subscriptions.filter((s) => s.id === id)).toHaveLength(1);
    expect(() => castVote(store, "proposal", id, "diego", true)).toThrow();
  });
  it("excludes the payer and requires two other reviewers", () => {
    let store = seedFinance();
    expect(() =>
      castVote(store, "payment", "demo-paid-host", "rober", true),
    ).toThrow("propio pago");
    expect(() =>
      castVote(store, "payment", "demo-paid-host", "jose", true),
    ).toThrow();
    store = castVote(store, "payment", "demo-paid-host", "jhony", true);
    expect(store.payments.find((p) => p.id === "demo-paid-host")?.status).toBe(
      "approved",
    );
  });
  it("rejects when two votes make the approval threshold unreachable", () => {
    let store = seedFinance();
    store = castVote(store, "proposal", "demo-domain", "jhony", false);
    store = castVote(store, "proposal", "demo-domain", "rober", false);
    expect(store.proposals.find((p) => p.id === "demo-domain")?.status).toBe(
      "rejected",
    );
  });
  it("preserves payment history and advances a split cycle only after all four are validated", () => {
    let store = seedFinance();
    const sub = store.subscriptions[0]!;
    const period = sub.date;
    for (const r of reviewers) {
      const payment: Payment = {
        id: r.id,
        title: sub.title,
        amount: contribution(sub, r.id),
        currency: sub.currency,
        category: sub.category,
        date: period,
        payer: r.id,
        destination: sub.destination,
        holder: sub.holder,
        receipt: "test",
        receiptName: "test.png",
        votes: [],
        status: "pending",
        subscriptionId: sub.id,
        period,
      };
      store.payments.push(payment);
      for (const other of reviewers.filter((o) => o.id !== r.id).slice(0, 2))
        store = castVote(store, "payment", payment.id, other.id, true);
      expect(store.subscriptions[0]!.date).toBe(
        r.id === "diego" ? nextDate(period, sub.frequency) : period,
      );
    }
    expect(
      store.payments.filter(
        (p) =>
          p.subscriptionId === sub.id &&
          p.period === period &&
          p.status === "approved",
      ),
    ).toHaveLength(4);
  });
  it("handles month ends, leap years and distributes rounding cents exactly", () => {
    expect(nextDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextDate("2024-02-29", "yearly")).toBe("2025-02-28");
    expect(nextDate("2026-12-31", "weekly")).toBe("2027-01-07");
    const sub = { ...seedFinance().subscriptions[0]!, amount: 100.01 };
    expect(
      reviewers.reduce(
        (s, r) => s + Math.round(contribution(sub, r.id) * 100),
        0,
      ),
    ).toBe(10001);
  });
});
