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

  it("getPreferences devuelve las guardadas", async () => {
    const { client, calls } = fakeClient({
      tables: {
        notification_preferences: ok({
          user_id: "u1",
          task_assigned: false,
          hours_reminder: true,
          weekly_summary: false,
          updated_at: "2026-10-06T10:00:00+00:00",
        }),
      },
    });
    expect(await createNotificationService(client).getPreferences()).toEqual({
      taskAssigned: false,
      hoursReminder: true,
      weeklySummary: false,
    });
    expect(argsOf(calls, "notification_preferences", "eq")).toEqual([["user_id", "u1"]]);
  });

  it("sin fila guardada todo está activado", async () => {
    const { client } = fakeClient({ tables: { notification_preferences: ok(null) } });
    expect(await createNotificationService(client).getPreferences()).toEqual({
      taskAssigned: true,
      hoursReminder: true,
      weeklySummary: true,
    });
  });

  it("updatePreferences envía solo lo indicado y devuelve el resultado", async () => {
    const { client, calls } = fakeClient({
      rpc: {
        set_notification_preferences: ok({
          user_id: "u1",
          task_assigned: false,
          hours_reminder: true,
          weekly_summary: true,
          updated_at: "2026-10-06T10:00:00+00:00",
        }),
      },
    });
    const result = await createNotificationService(client).updatePreferences({
      taskAssigned: false,
    });
    expect(result).toEqual({ taskAssigned: false, hoursReminder: true, weeklySummary: true });
    expect(argsOf(calls, "rpc:set_notification_preferences", "call")).toEqual([
      [
        {
          p_task_assigned: false,
          p_hours_reminder: undefined,
          p_weekly_summary: undefined,
        },
      ],
    ]);
  });

  it("traduce los errores al guardar preferencias", async () => {
    const { client } = fakeClient({
      rpc: {
        set_notification_preferences: {
          data: null,
          error: { message: "permission denied for function", code: "42501" },
        },
      },
    });
    await expect(
      createNotificationService(client).updatePreferences({ weeklySummary: false }),
    ).rejects.toThrow("Tu rol no permite esta acción");
  });
});
