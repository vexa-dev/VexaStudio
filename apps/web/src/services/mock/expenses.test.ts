import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(() => {
  resetMock();
  setSessionUserId("u-jhony");
});
afterEach(resetMock);

describe("lecturas compartidas de gastos", () => {
  it("lee el estado persistido en lugar de regenerar el seed y devuelve copias", async () => {
    const db = getDb();
    db.expenses[0].concept = "Concepto actualizado";
    db.expenseVotes.push({
      expenseId: db.expenses[0].id,
      userId: "u-jhony",
      inFavor: true,
    });
    const services = createMockServices();
    const [expenses, votes] = await Promise.all([
      services.expenses.list(),
      services.expenses.listVotes(db.expenses[0].id),
    ]);
    expect(expenses[0].concept).toBe("Concepto actualizado");
    expect(votes).toContainEqual({
      expenseId: db.expenses[0].id,
      userId: "u-jhony",
      inFavor: true,
    });
    expenses[0].concept = "Cambio del consumidor";
    expect(db.expenses[0].concept).toBe("Concepto actualizado");
  });
});

const PNG = "data:image/png;base64,aGVsbG8=";
const base = {
  amount: 30,
  currency: "PEN" as const,
  concept: "  Dominio  ",
  category: "infrastructure" as const,
  receiptUrl: null,
};

describe("crear gastos", () => {
  it("aprueba solo hasta el límite y deja pendiente lo demás o lo que no está en soles", async () => {
    setSessionUserId("u-rober");
    const { expenses } = createMockServices();
    const small = await expenses.create(base);
    const limit = await expenses.create({ ...base, amount: 50 });
    const large = await expenses.create({ ...base, amount: 50.01 });
    const usd = await expenses.create({ ...base, amount: 10, currency: "USD" });
    expect([small.status, limit.status, large.status, usd.status]).toEqual([
      "approved",
      "approved",
      "pending",
      "pending",
    ]);
    expect(small).toMatchObject({
      paidBy: "u-rober",
      concept: "Dominio",
      reimbursed: false,
      beforeSigning: false,
      voidReason: null,
    });
    expect((await expenses.list()).some((e) => e.id === large.id)).toBe(true);
  });

  it("valida monto, concepto y comprobante", async () => {
    const { expenses } = createMockServices();
    await expect(expenses.create({ ...base, amount: 0 })).rejects.toThrow(
      "El monto debe ser mayor a cero",
    );
    await expect(expenses.create({ ...base, concept: "  " })).rejects.toThrow(
      "Escribe el concepto del gasto",
    );
    await expect(
      expenses.create({ ...base, receiptUrl: "data:text/html;base64,aGVsbG8=" }),
    ).rejects.toThrow("El comprobante no es válido");
    const big = `data:image/png;base64,${"A".repeat(4 * 1024 * 1024 + 4)}`;
    await expect(expenses.create({ ...base, receiptUrl: big })).rejects.toThrow(
      "El comprobante pesa demasiado",
    );
  });

  it("guarda el comprobante y lo devuelve por getReceiptUrl", async () => {
    const { expenses } = createMockServices();
    const created = await expenses.create({ ...base, receiptUrl: PNG });
    expect(created.receiptUrl).toBe(PNG);
    expect(await expenses.getReceiptUrl(created.id)).toBe(PNG);
    expect(await expenses.getReceiptUrl("e-1")).toBeNull();
  });

  it("los colaboradores no registran ni votan ni anulan", async () => {
    setSessionUserId("u-alex");
    const { expenses } = createMockServices();
    const msg = "socios y administradores";
    await expect(expenses.create(base)).rejects.toThrow(msg);
    await expect(expenses.vote("e-2", true)).rejects.toThrow(msg);
    await expect(expenses.void("e-1", "Motivo claro")).rejects.toThrow(msg);
  });
});

describe("votar gastos", () => {
  it("aprueba con 3 votos a favor y rechaza cuando ya no se alcanzan", async () => {
    setSessionUserId("u-rober");
    const created = await createMockServices().expenses.create({ ...base, amount: 80 });
    for (const [userId, expected] of [
      ["u-jhony", "pending"],
      ["u-jose", "pending"],
      ["u-diego", "approved"],
    ] as const) {
      setSessionUserId(userId);
      expect((await createMockServices().expenses.vote(created.id, true)).status).toBe(expected);
    }
    setSessionUserId("u-rober");
    const other = await createMockServices().expenses.create({ ...base, amount: 80 });
    setSessionUserId("u-jhony");
    expect((await createMockServices().expenses.vote(other.id, false)).status).toBe("pending");
    setSessionUserId("u-jose");
    expect((await createMockServices().expenses.vote(other.id, false)).status).toBe("rejected");
  });

  it("no admite votos repetidos, en gastos resueltos ni de gastos inexistentes", async () => {
    setSessionUserId("u-jhony");
    const { expenses } = createMockServices();
    await expect(expenses.vote("e-2", true)).rejects.toThrow("Ya votaste en este gasto");
    await expect(expenses.vote("e-1", true)).rejects.toThrow("Este gasto ya no admite votos");
    await expect(expenses.vote("nope", true)).rejects.toThrow("El gasto no existe");
    expect((await expenses.listVotes("e-2")).filter((v) => v.userId === "u-jhony")).toHaveLength(1);
  });
});

describe("anular gastos", () => {
  it("solo quien pagó anula, con motivo, y queda anulado para siempre", async () => {
    setSessionUserId("u-rober");
    const { expenses } = createMockServices();
    const created = await expenses.create({ ...base, amount: 80 });
    await expect(expenses.void(created.id, "ab")).rejects.toThrow(
      "Escribe el motivo de la anulación",
    );
    setSessionUserId("u-jhony");
    await expect(expenses.void(created.id, "Motivo claro")).rejects.toThrow(
      "Solo quien pagó el gasto puede anularlo",
    );
    setSessionUserId("u-rober");
    const voided = await expenses.void(created.id, "  Lo registré dos veces  ");
    expect(voided).toMatchObject({ status: "voided", voidReason: "Lo registré dos veces" });
    await expect(expenses.void(created.id, "Otra vez")).rejects.toThrow("El gasto ya está anulado");
    setSessionUserId("u-jhony");
    await expect(expenses.vote(created.id, true)).rejects.toThrow("Este gasto ya no admite votos");
    await expect(expenses.void("nope", "Motivo claro")).rejects.toThrow(
      "El gasto no existe o no tienes permiso",
    );
  });

  it("un gasto anulado deja de dar puntos", async () => {
    setSessionUserId("u-rober");
    const { expenses, dashboard } = createMockServices();
    const created = await expenses.create({ ...base, amount: 40 });
    const points = async () =>
      (await dashboard.getPoints()).find((p) => p.userId === "u-rober")!.moneyPoints;
    const before = await points();
    await expenses.void(created.id, "Lo registré dos veces");
    expect(before - (await points())).toBe(80);
  });
});
