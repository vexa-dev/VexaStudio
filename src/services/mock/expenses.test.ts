import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetMock } from "./db";
import { createMockServices } from "./index";

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
