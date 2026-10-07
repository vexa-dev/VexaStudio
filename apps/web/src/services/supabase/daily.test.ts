import { describe, expect, it } from "vitest";
import { todayLima } from "@vexa/domain/dates";
import type { Task, TimeEntry } from "@vexa/domain/types";
import { argsOf, fakeClient, ok } from "./fake-client";
import { createDailyService } from "./daily";

const row = {
  id: "d1",
  user_id: "u1",
  date: "2026-10-07",
  done: "Hice",
  will_do: "Haré",
  blockers: "",
  created_at: "2026-10-07T20:00:00+00:00",
  updated_at: "2026-10-07T21:30:15.123456+00:00",
};
const deps = (entries: TimeEntry[] = [], tasks: Task[] = []) => ({
  time: { listEntries: async () => entries },
  tasks: { list: async () => tasks },
});

describe("DailyService de Supabase", () => {
  it("lists mapped rows newest first and applies the filters", async () => {
    const { client, calls } = fakeClient({ tables: { daily_updates: ok([row]) } });
    const list = await createDailyService(client, deps()).list({ userId: "u1", date: "2026-10-07" });
    expect(list).toEqual([
      {
        id: "d1",
        userId: "u1",
        date: "2026-10-07",
        done: "Hice",
        willDo: "Haré",
        blockers: "",
        updatedAt: "2026-10-07T21:30:15.123Z",
      },
    ]);
    expect(argsOf(calls, "daily_updates", "eq")).toEqual([["user_id", "u1"], ["date", "2026-10-07"]]);
    expect(argsOf(calls, "daily_updates", "order")[0]).toEqual(["date", { ascending: false }]);
  });

  it("requires a session to read", async () => {
    const { client } = fakeClient({ userId: null });
    await expect(createDailyService(client, deps()).list()).rejects.toThrow("Inicia sesión");
  });

  it("upserts today's trimmed daily on (user_id, date) without sending user_id", async () => {
    const { client, calls } = fakeClient({ tables: { daily_updates: ok(row) } });
    const sent = await createDailyService(client, deps()).submit({ done: "  Hice ", willDo: "Haré", blockers: "" });
    expect(sent.id).toBe("d1");
    const [payload, options] = argsOf(calls, "daily_updates", "upsert")[0];
    expect(payload).toEqual({ date: todayLima(), done: "Hice", will_do: "Haré", blockers: "" });
    expect(options).toEqual({ onConflict: "user_id,date" });
  });

  it("validates before going to the network and translates database errors", async () => {
    const empty = fakeClient();
    await expect(
      createDailyService(empty.client, deps()).submit({ done: " ", willDo: "", blockers: "" }),
    ).rejects.toThrow("qué hiciste");
    expect(empty.calls).toHaveLength(0);
    const denied = fakeClient({
      tables: { daily_updates: { data: null, error: { message: "new row violates row-level security policy", code: "42501" } } },
    });
    await expect(
      createDailyService(denied.client, deps()).submit({ done: "a", willDo: "", blockers: "" }),
    ).rejects.toThrow("Tu rol no permite esta acción");
  });

  it("suggests the same text as the mock from hours and tasks since the last daily", async () => {
    const started = new Date(Date.now() - 3600_000).toISOString();
    const entry = {
      id: "e",
      userId: "u1",
      taskId: "t1",
      startedAt: started,
      endedAt: new Date().toISOString(),
      hours: 1,
      paid: false,
      validated: false,
      validatedAt: null,
      createdAt: started,
      voidedAt: null,
      voidReason: null,
    } satisfies TimeEntry;
    const task: Task = {
      id: "t1",
      sprintId: null,
      projectId: null,
      title: "Reglas de puntos",
      status: "in_progress",
      assigneeId: "u1",
      estimateHours: null,
      link: null,
    };
    const { client } = fakeClient({ tables: { daily_updates: ok([]) } });
    expect(await createDailyService(client, deps([entry], [task])).suggestDone()).toBe("• Reglas de puntos");
  });
});
