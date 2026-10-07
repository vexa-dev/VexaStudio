import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok } from "./fake-client";
import { createSprintService } from "./sprints";

const T = "2026-10-03T17:00:00+00:00";
const sprintRow = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  project_id: "p1",
  start_date: "2026-10-01",
  end_date: "2026-10-14",
  goal: "Meta",
  status: "active",
  created_at: T,
  updated_at: T,
  closed_at: null,
  closed_by: null,
  close_report: null,
  ...over,
});
const taskRow = (id: string, assignee: string, status: string, estimate: number | null) => ({
  id,
  sprint_id: "s1",
  project_id: "p1",
  title: id,
  description: null,
  status,
  assignee_id: assignee,
  estimate_hours: estimate,
  link: null,
  hours_prepared: false,
  created_at: T,
  updated_at: T,
  task_labels: [],
});
const entryRow = (id: string, userId: string, taskId: string | null, hours: number, over = {}) => ({
  id,
  user_id: userId,
  task_id: taskId,
  project_id: "p1",
  description: null,
  evidence_url: null,
  source: null,
  started_at: "2026-10-02T15:00:00+00:00",
  ended_at: "2026-10-02T17:00:00+00:00",
  hours,
  paid: false,
  validated: false,
  validated_at: null,
  validated_by: null,
  review_note: null,
  reviewed_by: null,
  draft: false,
  timer_state: null,
  elapsed_ms: 0,
  segment_started_at: null,
  segments: null,
  allocations: null,
  created_at: T,
  voided_at: null,
  void_reason: null,
  locked_by_sprint: null,
  time_entry_participants: [],
  time_entry_evidence: [],
  ...over,
});

describe("SprintService de Supabase: cierre", () => {
  it("close llama al RPC con ids únicos y devuelve el sprint cerrado", async () => {
    const closed = sprintRow({
      status: "closed",
      closed_at: T,
      closed_by: "u1",
      close_report: {
        partners: [{ userId: "u2", committed: 1, delivered: 1, estimatedHours: 2, loggedHours: 2 }],
        pendingEntryIds: ["e9"],
      },
    });
    const { client, calls } = fakeClient({ rpc: { close_sprint: ok(closed) } });
    const sprint = await createSprintService(client).close("s1", ["e1", "e1", "e2"]);
    expect(argsOf(calls, "rpc:close_sprint", "call")[0]).toEqual([
      { p_sprint: "s1", p_entry_ids: ["e1", "e2"] },
    ]);
    expect(sprint).toMatchObject({
      status: "closed",
      closedById: "u1",
      closePendingEntryIds: ["e9"],
    });
    expect(sprint.deliveryReport).toEqual([
      { userId: "u2", committed: 1, delivered: 1, estimatedHours: 2, loggedHours: 2 },
    ]);
  });

  it("close propaga el error de la base", async () => {
    const { client } = fakeClient({
      rpc: { close_sprint: { data: null, error: { message: "Solo un administrador puede cerrar un sprint" } } },
    });
    await expect(createSprintService(client).close("s1", [])).rejects.toThrow(
      "Solo un administrador puede cerrar un sprint",
    );
  });

  it("el reporte de un sprint abierto sale de las tareas y las horas", async () => {
    const { client } = fakeClient({
      tables: {
        sprints: ok(sprintRow()),
        tasks: ok([taskRow("t1", "u2", "done", 2), taskRow("t2", "u3", "todo", 3)]),
        time_entries: ok([
          entryRow("e1", "u2", "t1", 2),
          entryRow("e2", "u3", "t2", 1, { validated: true, validated_at: T, validated_by: "u1" }),
        ]),
      },
    });
    const report = await createSprintService(client).getCloseReport!("s1");
    expect(report.sprint.status).toBe("active");
    expect(report.partners).toEqual([
      { userId: "u2", committed: 1, delivered: 1, estimatedHours: 2, loggedHours: 2 },
      { userId: "u3", committed: 1, delivered: 0, estimatedHours: 3, loggedHours: 1 },
    ]);
    expect(report.pendingEntries.map((e) => e.id)).toEqual(["e1"]);
  });

  it("el de un sprint cerrado es el guardado, con las horas aún pendientes", async () => {
    const partners = [{ userId: "u2", committed: 2, delivered: 1, estimatedHours: 5, loggedHours: 4 }];
    const { client, calls } = fakeClient({
      tables: {
        sprints: ok(
          sprintRow({
            status: "closed",
            closed_at: T,
            closed_by: "u1",
            close_report: { partners, pendingEntryIds: ["e1", "e2"] },
          }),
        ),
        time_entries: ok([
          entryRow("e1", "u2", "t1", 2),
          entryRow("e2", "u3", null, 1, { validated: true, validated_at: T, validated_by: "u1" }),
        ]),
      },
    });
    const report = await createSprintService(client).getCloseReport!("s1");
    expect(report.partners).toEqual(partners);
    expect(report.pendingEntries.map((e) => e.id)).toEqual(["e1"]);
    expect(calls.some((c) => c.target === "tasks")).toBe(false);
  });

  it("un sprint inexistente falla con mensaje claro", async () => {
    const { client } = fakeClient({ tables: { sprints: ok(null) } });
    await expect(createSprintService(client).getCloseReport!("zz")).rejects.toThrow(
      "El sprint no existe",
    );
  });
});
