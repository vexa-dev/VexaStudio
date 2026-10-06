import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok } from "./fake-client";
import { createNotificationService } from "./notifications";

const row = (id: string, read: boolean) => ({
  id,
  user_id: "u1",
  type: "task_assigned",
  payload: { title: `Aviso ${id}`, taskId: "t1" },
  read_at: read ? "2026-10-05T16:00:00+00:00" : null,
  created_at: "2026-10-05T15:00:00+00:00",
});

describe("NotificationService de Supabase", () => {
  it("lista los avisos propios, recientes primero y con tope de 50", async () => {
    const { client, calls } = fakeClient({
      tables: { notifications: ok([row("n1", false), row("n2", true)]) },
    });
    const items = await createNotificationService(client).list();
    expect(items.map((n) => [n.id, n.read])).toEqual([
      ["n1", false],
      ["n2", true],
    ]);
    expect(items[0].payload.title).toBe("Aviso n1");
    expect(argsOf(calls, "notifications", "order")).toEqual([
      ["created_at", { ascending: false }],
    ]);
    expect(argsOf(calls, "notifications", "limit")).toEqual([[50]]);
  });

  it("markRead llama al RPC con el id", async () => {
    const { client, calls } = fakeClient({
      rpc: { mark_notification_read: ok(true) },
    });
    await createNotificationService(client).markRead("n1");
    expect(argsOf(calls, "rpc:mark_notification_read", "call")).toEqual([
      [{ p_id: "n1" }],
    ]);
  });

  it("markAllRead llama al RPC sin argumentos", async () => {
    const { client, calls } = fakeClient({
      rpc: { mark_all_notifications_read: ok(2) },
    });
    await createNotificationService(client).markAllRead();
    expect(argsOf(calls, "rpc:mark_all_notifications_read", "call")).toHaveLength(1);
  });

  it("traduce los errores del servidor", async () => {
    const { client } = fakeClient({
      rpc: {
        mark_notification_read: {
          data: null,
          error: { message: "permission denied for function", code: "42501" },
        },
      },
    });
    await expect(createNotificationService(client).markRead("n1")).rejects.toThrow(
      "Tu rol no permite esta acción",
    );
  });
});
