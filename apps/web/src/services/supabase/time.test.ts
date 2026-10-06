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

  it("crear con etiquetas las envía en la RPC y devuelve el registro con sus listas", async () => {
    const { client, calls } = fakeClient({
      rpc: { add_manual_hours: ok(entryRow) },
      tables: {
        time_entries: ok([
          {
            ...entryRow,
            time_entry_participants: [
              { entry_id: "h1", user_id: "u2", share_percent: 75, created_at: entryRow.created_at },
            ],
            time_entry_evidence: [],
          },
        ]),
      },
    });
    const entry = await createTimeService(client).addManual({
      taskId: null,
      date: "2026-10-03",
      hours: 2,
      description: "Trabajo con apoyo",
      participants: [{ userId: "u2", sharePercent: 75 }, { userId: "u3" }],
    });
    expect(argsOf(calls, "rpc:add_manual_hours", "call")[0][0]).toMatchObject({
      p_participants: [{ userId: "u2", sharePercent: 75 }, { userId: "u3" }],
    });
    expect(entry.participants).toEqual([{ userId: "u2", sharePercent: 75 }]);
  });

  it("sin etiquetas no envía p_participants y, si no puede releer, conserva la fila de la RPC", async () => {
    const { client, calls } = fakeClient({ rpc: { add_manual_hours: ok(entryRow) } });
    const entry = await createTimeService(client).addManual({
      taskId: null,
      date: "2026-10-03",
      hours: 2,
      description: "Trabajo sin apoyo",
    });
    expect(argsOf(calls, "rpc:add_manual_hours", "call")[0][0]).toMatchObject({
      p_participants: undefined,
    });
    expect(entry.id).toBe("h1");
    expect(entry.participants).toEqual([]);
  });

  it("confirmar borradores envía las etiquetas", async () => {
    const { client, calls } = fakeClient({ rpc: { submit_hours_drafts: ok(entryRow) } });
    await createTimeService(client).submitDrafts({
      items: [{ id: "d1", hours: 1 }],
      date: "2026-10-03",
      participants: [{ userId: "u2" }],
    });
    expect(argsOf(calls, "rpc:submit_hours_drafts", "call")[0][0]).toMatchObject({
      p_participants: [{ userId: "u2" }],
    });
  });

  it("el historial trae etiquetas y evidencia en la misma consulta", async () => {
    const { client, calls } = fakeClient({ tables: { time_entries: ok([entryRow]) } });
    await createTimeService(client).listEntries();
    expect(argsOf(calls, "time_entries", "select")[0][0]).toBe(
      "*, time_entry_participants(*), time_entry_evidence(*)",
    );
  });

  it("setParticipants llama a la RPC y relee el registro", async () => {
    const { client, calls } = fakeClient({
      rpc: { set_hours_participants: ok(entryRow) },
      tables: {
        time_entries: ok([
          {
            ...entryRow,
            time_entry_participants: [
              { entry_id: "h1", user_id: "u2", share_percent: 40, created_at: entryRow.created_at },
            ],
            time_entry_evidence: [],
          },
        ]),
      },
    });
    const entry = await createTimeService(client).setParticipants("h1", [
      { userId: "u2", sharePercent: 40 },
    ]);
    expect(argsOf(calls, "rpc:set_hours_participants", "call")[0][0]).toEqual({
      p_entry: "h1",
      p_participants: [{ userId: "u2", sharePercent: 40 }],
    });
    expect(entry.participants).toEqual([{ userId: "u2", sharePercent: 40 }]);
  });

  it("traduce las reglas de etiquetas de la base", async () => {
    const { client } = fakeClient({
      rpc: {
        set_hours_participants: {
          data: null,
          error: { message: "No puedes etiquetarte a ti mismo" },
        },
        validate_hours: {
          data: null,
          error: { message: "No puedes aprobar horas en las que estas etiquetado" },
        },
      },
    });
    const service = createTimeService(client);
    await expect(service.setParticipants("h1", [{ userId: "u1" }])).rejects.toThrow(
      "No puedes etiquetarte a ti mismo",
    );
    await expect(service.validate(["h1"])).rejects.toThrow(
      "No puedes aprobar horas en las que estás etiquetado",
    );
  });
});

const pdf = (text = "hola") => ({
  name: "Informe final.pdf",
  type: "application/pdf",
  data: `data:application/pdf;base64,${btoa(text)}`,
});

const evidenceRow = {
  id: "ev1",
  entry_id: "h1",
  uploader_id: "u1",
  path: "h1/ev1/Informe_final.pdf",
  name: "Informe final.pdf",
  mime: "application/pdf",
  size: 4,
  created_at: "2026-10-03T17:00:00+00:00",
  purge_after: null,
  purged_at: null,
};

describe("evidencia de horas (Supabase)", () => {
  it("sube el objeto a <registro>/<id>/<archivo> y registra la fila", async () => {
    const { client, calls } = fakeClient({ tables: { time_entry_evidence: ok(evidenceRow) } });
    const evidence = await createTimeService(client).addEvidence("h1", pdf());
    const [path, , options] = argsOf(calls, "storage:hours-evidence", "upload")[0] as [
      string,
      Blob,
      { contentType: string; upsert: boolean },
    ];
    expect(path).toMatch(/^h1\/[0-9a-f-]{36}\/Informe_final\.pdf$/);
    expect(options).toMatchObject({ contentType: "application/pdf", upsert: false });
    const inserted = argsOf(calls, "time_entry_evidence", "insert")[0][0] as Record<string, unknown>;
    expect(inserted).toMatchObject({
      entry_id: "h1",
      path,
      name: "Informe final.pdf",
      mime: "application/pdf",
      size: 4,
    });
    expect(path).toContain(String(inserted.id));
    expect(evidence).toMatchObject({ id: "ev1", name: "Informe final.pdf", purged: false });
  });

  it("rechaza tipos no permitidos y archivos grandes antes de subir nada", async () => {
    const { client, calls } = fakeClient();
    const service = createTimeService(client);
    await expect(
      service.addEvidence("h1", { name: "a.svg", type: "image/svg+xml", data: "data:image/svg+xml;base64,AAAA" }),
    ).rejects.toThrow("Este tipo de archivo no está permitido.");
    await expect(
      service.addEvidence("h1", { ...pdf(), data: "no es un data url" }),
    ).rejects.toThrow("El archivo adjunto no es válido.");
    expect(argsOf(calls, "storage:hours-evidence", "upload")).toHaveLength(0);
  });

  it("si la fila falla, quita el objeto subido y muestra el motivo", async () => {
    const { client, calls } = fakeClient({
      tables: {
        time_entry_evidence: {
          data: null,
          error: { message: "Cada registro admite hasta 5 archivos." },
        },
      },
    });
    await expect(createTimeService(client).addEvidence("h1", pdf())).rejects.toThrow(
      "Cada registro admite hasta 5 archivos.",
    );
    expect(argsOf(calls, "storage:hours-evidence", "remove")).toHaveLength(1);
  });

  it("quita primero el objeto y luego la fila", async () => {
    const { client, calls } = fakeClient({
      tables: { time_entry_evidence: ok({ path: evidenceRow.path, purged_at: null }) },
    });
    await createTimeService(client).removeEvidence("ev1");
    expect(argsOf(calls, "storage:hours-evidence", "remove")[0][0]).toEqual([evidenceRow.path]);
    const order = calls.map((c) => `${c.target}.${c.method}`);
    expect(order.indexOf("storage:hours-evidence.remove")).toBeLessThan(
      order.indexOf("time_entry_evidence.delete"),
    );
  });

  it("firma la URL de un archivo vigente y rechaza uno retirado", async () => {
    const live = fakeClient({
      tables: { time_entry_evidence: ok({ path: evidenceRow.path, purged_at: null }) },
    });
    expect(await createTimeService(live.client).getEvidenceUrl("ev1")).toBe(
      `https://files.test/${evidenceRow.path}?t=1`,
    );
    expect(argsOf(live.calls, "storage:hours-evidence", "createSignedUrl")[0]).toEqual([
      evidenceRow.path,
      3600,
    ]);
    const gone = fakeClient({
      tables: {
        time_entry_evidence: ok({ path: evidenceRow.path, purged_at: "2026-10-12T00:00:00+00:00" }),
      },
    });
    await expect(createTimeService(gone.client).getEvidenceUrl("ev1")).rejects.toThrow(
      "El archivo ya fue eliminado para liberar espacio.",
    );
  });

  it("el barrido quita el objeto vencido y luego registra el retiro", async () => {
    const { client, calls } = fakeClient({
      tables: { time_entry_evidence: ok([{ id: "ev1", path: evidenceRow.path }]) },
    });
    expect(await createTimeService(client).purgeExpiredEvidence()).toBe(1);
    const eq = argsOf(calls, "time_entry_evidence", "is");
    expect(eq).toContainEqual(["purged_at", null]);
    const order = calls.map((c) => `${c.target}.${c.method}`);
    expect(order.indexOf("storage:hours-evidence.remove")).toBeLessThan(
      order.indexOf("time_entry_evidence.update"),
    );
    expect(argsOf(calls, "time_entry_evidence", "update")[0][0]).toMatchObject({
      purged_at: expect.any(String),
    });
  });

  it("el barrido nunca falla: ni por la consulta ni por Storage", async () => {
    const broken = fakeClient({
      tables: { time_entry_evidence: { data: null, error: { message: "boom" } } },
    });
    expect(await createTimeService(broken.client).purgeExpiredEvidence()).toBe(0);
    const storageDown = fakeClient({
      tables: { time_entry_evidence: ok([{ id: "ev1", path: evidenceRow.path }]) },
      storage: { remove: { data: null, error: { message: "failed to fetch" } } },
    });
    expect(await createTimeService(storageDown.client).purgeExpiredEvidence()).toBe(0);
    expect(argsOf(storageDown.calls, "time_entry_evidence", "update")).toHaveLength(0);
  });
});
