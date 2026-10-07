import { describe, expect, it } from "vitest";
import { createExpenseService } from "./expenses";
import { argsOf, fakeClient, ok, profileRow } from "./fake-client";

const row = {
  id: "g1",
  paid_by: "u1",
  amount: 80,
  currency: "PEN",
  concept: "Licencia",
  category: "software",
  receipt_url: null,
  status: "pending",
  reimbursed: false,
  before_signing: false,
  created_at: "2026-10-03T17:00:00+00:00",
  voided_at: null,
  void_reason: null,
};
const PNG = "data:image/png;base64,aGVsbG8=";
const input = {
  amount: 80,
  currency: "PEN" as const,
  concept: "Licencia",
  category: "software" as const,
  receiptUrl: null,
};

describe("ExpenseService de Supabase", () => {
  it("crea el gasto por RPC sin comprobante y sin tocar Storage", async () => {
    const { client, calls } = fakeClient({ rpc: { create_expense: ok(row) } });
    const created = await createExpenseService(client).create(input);
    expect(created).toMatchObject({ id: "g1", status: "pending", receiptUrl: null });
    expect(argsOf(calls, "rpc:create_expense", "call")[0][0]).toEqual({
      p_amount: 80,
      p_currency: "PEN",
      p_concept: "Licencia",
      p_category: "software",
      p_receipt_url: undefined,
      p_before_signing: false,
    });
    expect(calls.some((c) => c.target.startsWith("storage:"))).toBe(false);
  });

  it("sube el comprobante a <usuario>/<id>.<ext> con caché larga y guarda solo la ruta", async () => {
    const { client, calls } = fakeClient({ rpc: { create_expense: ok(row) } });
    await createExpenseService(client).create({ ...input, receiptUrl: PNG });
    const [path, blob, options] = argsOf(calls, "storage:receipts", "upload")[0] as [
      string,
      Blob,
      { contentType: string; upsert: boolean; cacheControl: string },
    ];
    expect(path).toMatch(/^u1\/[0-9a-f-]{36}\.png$/);
    expect(blob.size).toBe(5);
    expect(options).toEqual({ contentType: "image/png", upsert: false, cacheControl: "31536000" });
    const rpc = argsOf(calls, "rpc:create_expense", "call")[0][0] as Record<string, unknown>;
    expect(rpc.p_receipt_url).toBe(path);
  });

  it("valida el comprobante antes de subir nada", async () => {
    const { client, calls } = fakeClient();
    const service = createExpenseService(client);
    await expect(
      service.create({ ...input, receiptUrl: "data:text/html;base64,aGVsbG8=" }),
    ).rejects.toThrow("El comprobante no es válido");
    const big = `data:image/png;base64,${"A".repeat(8 * 1024 * 1024)}`;
    await expect(service.create({ ...input, receiptUrl: big })).rejects.toThrow(
      "El comprobante pesa demasiado",
    );
    expect(calls).toHaveLength(0);
  });

  it("si la RPC falla, quita el objeto subido y muestra el motivo", async () => {
    const { client, calls } = fakeClient({
      rpc: { create_expense: { data: null, error: { message: "Solo puedes registrar gastos pagados por ti" } } },
    });
    await expect(
      createExpenseService(client).create({ ...input, receiptUrl: PNG }),
    ).rejects.toThrow("Solo puedes registrar gastos pagados por ti");
    const uploaded = argsOf(calls, "storage:receipts", "upload")[0][0];
    expect(argsOf(calls, "storage:receipts", "remove")[0][0]).toEqual([uploaded]);
  });

  it("vota y anula por RPC", async () => {
    const { client, calls } = fakeClient({
      rpc: {
        vote_expense: ok({ ...row, status: "approved" }),
        void_expense: ok({ ...row, status: "voided", voided_at: "2026-10-04T10:00:00+00:00", void_reason: "Duplicado" }),
      },
    });
    const service = createExpenseService(client);
    expect((await service.vote("g1", true)).status).toBe("approved");
    expect(argsOf(calls, "rpc:vote_expense", "call")[0][0]).toEqual({ p_expense: "g1", p_in_favor: true });
    const voided = await service.void("g1", "Duplicado");
    expect(voided).toMatchObject({ status: "voided", voidReason: "Duplicado" });
  });

  it("traduce el voto repetido", async () => {
    const { client } = fakeClient({
      rpc: {
        vote_expense: {
          data: null,
          error: {
            message: 'duplicate key value violates unique constraint "expense_votes_pkey"',
            code: "23505",
          },
        },
      },
    });
    await expect(createExpenseService(client).vote("g1", true)).rejects.toThrow(
      "Ya votaste en este gasto",
    );
  });

  it("firma la URL del comprobante o devuelve null sin él", async () => {
    const withReceipt = fakeClient({
      tables: { profiles: ok(profileRow("partner")), expenses: ok({ receipt_url: "u1/a.png" }) },
    });
    expect(await createExpenseService(withReceipt.client).getReceiptUrl("g1")).toBe(
      "https://files.test/u1/a.png?t=1",
    );
    expect(argsOf(withReceipt.calls, "storage:receipts", "createSignedUrl")[0]).toEqual([
      "u1/a.png",
      3600,
    ]);
    const without = fakeClient({
      tables: { profiles: ok(profileRow("partner")), expenses: ok({ receipt_url: null }) },
    });
    expect(await createExpenseService(without.client).getReceiptUrl("g1")).toBeNull();
  });
});
