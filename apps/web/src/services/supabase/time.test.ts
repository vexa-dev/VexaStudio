import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok } from "./fake-client";
import { createTimeService } from "./time";

const entryRow = {
  id: "h1",
  user_id: "u1",
  task_id: "t1",
  project_id: null,
  description: "Trabajo",
  evidence_url: null,
  source: "timer",
  started_at: "2026-10-03T17:00:00+00:00",
  ended_at: null,
  hours: 0,
  paid: false,
  validated: false,
  validated_at: null,
  validated_by: null,
  review_note: null,
  reviewed_by: null,
  draft: false,
  timer_state: "running",
  elapsed_ms: 0,
  segment_started_at: "2026-10-03T17:00:00+00:00",
  segments: [],
  allocations: null,
  created_at: "2026-10-03T17:00:00+00:00",
  voided_at: null,
  void_reason: null,
};

describe("TimeService de Supabase", () => {
  it("pausar sin reloj abierto devuelve null (la RPC trae un registro vacío)", async () => {
    const { client } = fakeClient({
      rpc: { pause_timer: ok({ ...entryRow, id: null }), stop_timer: ok(null) },
    });
    const service = createTimeService(client);
    expect(await service.pause()).toBeNull();
    expect(await service.stop()).toBeNull();
  });

  it("inicia el temporizador con los datos de la actividad", async () => {
    const { client, calls } = fakeClient({ rpc: { start_timer: ok(entryRow) } });
    const entry = await createTimeService(client).start(null, {
      description: "Revisión de contrato",
      projectId: "p1",
      evidenceUrl: null,
    });
    expect(entry.timerState).toBe("running");
    expect(argsOf(calls, "rpc:start_timer", "call")[0][0]).toEqual({
      p_task: undefined,
      p_description: "Revisión de contrato",
      p_project: "p1",
      p_evidence_url: undefined,
    });
  });

  it("el parche de edición omite lo ausente y conserva null", async () => {
    const { client, calls } = fakeClient({ rpc: { update_hours: ok(entryRow) } });
    await createTimeService(client).update("h1", {
      hours: 2,
      evidenceUrl: null,
      description: undefined,
    });
    expect(argsOf(calls, "rpc:update_hours", "call")[0][0]).toEqual({
      p_id: "h1",
      p_patch: { hours: 2, evidenceUrl: null },
    });
  });

  it("el historial excluye las sesiones de reloj en borrador y aplica los filtros", async () => {
    const { client, calls } = fakeClient({ tables: { time_entries: ok([entryRow]) } });
    await createTimeService(client).listEntries({
      userId: "u1",
      from: "2026-10-01T00:00:00.000Z",
    });
    const eq = argsOf(calls, "time_entries", "eq");
    expect(eq).toContainEqual(["draft", false]);
    expect(eq).toContainEqual(["user_id", "u1"]);
    expect(argsOf(calls, "time_entries", "gte")[0]).toEqual([
      "started_at",
      "2026-10-01T00:00:00.000Z",
    ]);
  });

  it("confirma borradores con la lista de horas por borrador", async () => {
    const { client, calls } = fakeClient({
      rpc: { submit_hours_drafts: ok({ ...entryRow, ended_at: "2026-10-03T18:00:00+00:00" }) },
    });
    await createTimeService(client).submitDrafts({
      items: [{ id: "d1", hours: 1.5 }],
      date: "2026-10-03",
    });
    expect(argsOf(calls, "rpc:submit_hours_drafts", "call")[0][0]).toMatchObject({
      p_items: [{ id: "d1", hours: 1.5 }],
      p_date: "2026-10-03",
    });
  });

  it("traduce los errores de la base al mensaje del mock", async () => {
    const { client } = fakeClient({
      rpc: {
        void_hours: {
          data: null,
          error: { message: "Escribe el motivo de la anulacion" },
        },
      },
    });
    await expect(createTimeService(client).void("h1", "x")).rejects.toThrow(
      "Escribe el motivo de la anulación",
    );
  });
});
