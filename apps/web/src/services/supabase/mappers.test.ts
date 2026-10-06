import { describe, expect, it } from "vitest";
import type { Tables } from "./database.types";
import {
  isoInstant,
  mapAuditEntry,
  mapDraft,
  mapExpense,
  mapLabel,
  mapMemberPoints,
  mapMonthlySummary,
  mapNotification,
  mapProfile,
  mapProject,
  mapRecurring,
  mapSettings,
  mapSprint,
  mapTask,
  mapTimeEntry,
  mapTimeEntryOrNull,
  mapVote,
  taskPatchToColumns,
  type TaskRow,
} from "./mappers";

const T = "2026-10-03T17:00:00+00:00";
const ISO = "2026-10-03T17:00:00.000Z";

const timeRow: Tables<"time_entries"> = {
  id: "h1",
  user_id: "u1",
  task_id: null,
  project_id: null,
  description: "Trabajo",
  evidence_url: null,
  source: null,
  started_at: T,
  ended_at: "2026-10-03T19:30:00+00:00",
  hours: 2.5,
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
};

describe("isoInstant", () => {
  it("normaliza timestamptz de PostgREST a ISO UTC con milisegundos", () => {
    expect(isoInstant(T)).toBe(ISO);
    expect(isoInstant("2026-10-03T12:00:00-05:00")).toBe(ISO);
  });

  it("falla con un valor que no es fecha", () => {
    expect(() => isoInstant("no-fecha")).toThrow();
  });
});

describe("perfiles y ajustes", () => {
  it("mapea un perfil", () => {
    expect(
      mapProfile({
        id: "u1",
        name: "Jhony",
        role: "admin",
        area: "management_finance",
        weekly_hours: 15,
        active: true,
        avatar_path: "u1/avatar-1.webp",
        banner_path: null,
        created_at: T,
        updated_at: T,
      }),
    ).toEqual({
      id: "u1",
      name: "Jhony",
      role: "admin",
      area: "management_finance",
      weeklyHours: 15,
      active: true,
      joinedAt: ISO,
    });
  });

  it("mapea los ajustes y recorta los segundos de las horas", () => {
    expect(
      mapSettings({
        id: true,
        points_per_hour: 20,
        points_per_sol: 2,
        min_compliance: 0.8,
        weeks_per_month: 4,
        expense_approval_limit_pen: 50,
        entry_edit_days: 7,
        daily_reminder_time: "21:00:00",
        daily_reminder_weekdays: [1, 3, 5],
        weekly_hours_reminder_time: "20:00:00",
        weekly_hours_reminder_weekday: 0,
        updated_by: null,
        updated_at: T,
      }),
    ).toEqual({
      pointsPerHour: 20,
      pointsPerSol: 2,
      minCompliance: 0.8,
      weeksPerMonth: 4,
      expenseApprovalLimitPen: 50,
      entryEditDays: 7,
      dailyReminder: { time: "21:00", weekdays: [1, 3, 5] },
      weeklyHoursReminder: { time: "20:00", weekday: 0 },
    });
  });
});

describe("proyectos, etiquetas y sprints", () => {
  const label = {
    id: "l1",
    project_id: "p1",
    name: "Bug",
    color: "#ff0000",
    created_at: T,
    updated_at: T,
  };

  it("mapea un proyecto con sus miembros", () => {
    expect(
      mapProject({
        id: "p1",
        name: "Vexa Studio",
        type: "internal",
        status: "active",
        created_at: T,
        updated_at: T,
        project_members: [{ user_id: "u2" }, { user_id: "u1" }],
      }),
    ).toEqual({
      id: "p1",
      name: "Vexa Studio",
      type: "internal",
      status: "active",
      memberIds: ["u2", "u1"],
    });
  });

  it("un proyecto sin la relación de miembros no inventa miembros", () => {
    const project = mapProject({
      id: "p1",
      name: "X",
      type: "client",
      status: "paused",
      created_at: T,
      updated_at: T,
    });
    expect(project.memberIds).toEqual([]);
  });

  it("mapea una etiqueta", () => {
    expect(mapLabel(label)).toEqual({
      id: "l1",
      projectId: "p1",
      name: "Bug",
      color: "#ff0000",
    });
  });

  it("mapea un sprint", () => {
    expect(
      mapSprint({
        id: "s1",
        project_id: "p1",
        start_date: "2026-10-01",
        end_date: "2026-10-14",
        goal: "Meta",
        status: "active",
        created_at: T,
        updated_at: T,
      }),
    ).toEqual({
      id: "s1",
      projectId: "p1",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
      goal: "Meta",
      status: "active",
    });
  });
});

describe("tareas", () => {
  const row: TaskRow = {
    id: "t1",
    sprint_id: "s1",
    project_id: "p1",
    title: "Tarea",
    description: null,
    status: "todo",
    assignee_id: "u1",
    estimate_hours: null,
    link: null,
    hours_prepared: false,
    created_at: T,
    updated_at: T,
    task_labels: [
      {
        project_labels: {
          id: "l1",
          project_id: "p1",
          name: "Bug",
          color: "#ff0000",
          created_at: T,
          updated_at: T,
        },
      },
      { project_labels: null },
    ],
  };

  it("mapea una tarea con etiquetas y descarta las vacías", () => {
    const task = mapTask(row);
    expect(task).toEqual({
      id: "t1",
      sprintId: "s1",
      projectId: "p1",
      hoursPrepared: false,
      description: undefined,
      labels: [{ id: "l1", projectId: "p1", name: "Bug", color: "#ff0000" }],
      title: "Tarea",
      status: "todo",
      assigneeId: "u1",
      estimateHours: null,
      link: null,
    });
  });

  it("convierte un parche de dominio en columnas, solo con lo presente", () => {
    expect(
      taskPatchToColumns({
        title: "  Nuevo  ",
        assigneeId: null,
        estimateHours: 3,
        status: "done",
        labels: [],
        hoursPrepared: true,
      }),
    ).toEqual({
      title: "Nuevo",
      assignee_id: null,
      estimate_hours: 3,
      status: "done",
    });
    expect(taskPatchToColumns({})).toEqual({});
  });
});

describe("horas", () => {
  it("mapea un registro manual sin campos de reloj", () => {
    const entry = mapTimeEntry(timeRow);
    expect(entry).toMatchObject({
      id: "h1",
      userId: "u1",
      taskId: null,
      startedAt: ISO,
      endedAt: "2026-10-03T19:30:00.000Z",
      hours: 2.5,
      description: "Trabajo",
      source: undefined,
      timerState: undefined,
      segments: undefined,
      allocations: undefined,
      draft: false,
      validated: false,
      voidedAt: null,
    });
  });

  it("conserva segmentos y asignaciones jsonb", () => {
    const entry = mapTimeEntry({
      ...timeRow,
      source: "timer",
      timer_state: "paused",
      elapsed_ms: 3600000,
      segment_started_at: null,
      segments: [{ start: ISO, end: "2026-10-03T18:00:00.000Z" }],
      allocations: [{ taskId: "t1", title: "T", projectId: null, hours: 1 }],
    });
    expect(entry.source).toBe("timer");
    expect(entry.timerState).toBe("paused");
    expect(entry.elapsedMs).toBe(3600000);
    expect(entry.segments).toEqual([
      { start: ISO, end: "2026-10-03T18:00:00.000Z" },
    ]);
    expect(entry.allocations).toHaveLength(1);
  });

  it("un temporizador abierto no tiene fin", () => {
    const entry = mapTimeEntry({
      ...timeRow,
      ended_at: null,
      timer_state: "running",
      segment_started_at: T,
    });
    expect(entry.endedAt).toBeNull();
    expect(entry.segmentStartedAt).toBe(ISO);
  });

  it("una RPC sin fila devuelve null, no un registro vacío", () => {
    expect(mapTimeEntryOrNull(null)).toBeNull();
    expect(mapTimeEntryOrNull({ ...timeRow, id: null as never })).toBeNull();
    expect(mapTimeEntryOrNull(timeRow)?.id).toBe("h1");
  });

  it("mapea un borrador de horas", () => {
    expect(
      mapDraft({
        id: "d1",
        user_id: "u1",
        task_id: "t1",
        project_id: null,
        title: "Tarea",
        hours: 2,
        measured: true,
        draft_date: "2026-10-03",
        entry_ids: ["h1"],
        submitted_at: null,
        created_at: T,
      }),
    ).toEqual({
      id: "d1",
      userId: "u1",
      taskId: "t1",
      title: "Tarea",
      projectId: null,
      hours: 2,
      measured: true,
      date: "2026-10-03",
      entryIds: ["h1"],
      submittedAt: undefined,
    });
  });
});

describe("gastos", () => {
  it("mapea gasto, voto y recurrente", () => {
    expect(
      mapExpense({
        id: "e1",
        paid_by: "u1",
        amount: 13,
        currency: "USD",
        concept: "Dominio",
        category: "infrastructure",
        receipt_url: null,
        status: "approved",
        reimbursed: false,
        before_signing: true,
        created_at: T,
        voided_at: null,
        void_reason: null,
      }),
    ).toEqual({
      id: "e1",
      paidBy: "u1",
      amount: 13,
      currency: "USD",
      concept: "Dominio",
      category: "infrastructure",
      receiptUrl: null,
      status: "approved",
      reimbursed: false,
      beforeSigning: true,
      createdAt: ISO,
      voidReason: null,
    });
    expect(
      mapVote({ expense_id: "e1", user_id: "u2", in_favor: true, created_at: T }),
    ).toEqual({ expenseId: "e1", userId: "u2", inFavor: true });
    expect(
      mapRecurring({
        id: "r1",
        concept: "Dominio",
        amount: 13,
        currency: "USD",
        next_date: "2027-02-23",
        periodicity: "yearly",
        before_signing: true,
        created_at: T,
      }),
    ).toEqual({
      id: "r1",
      concept: "Dominio",
      amount: 13,
      currency: "USD",
      nextDate: "2027-02-23",
      periodicity: "yearly",
      beforeSigning: true,
    });
  });
});

describe("resúmenes", () => {
  it("mapea el resumen mensual y los puntos", () => {
    expect(
      mapMonthlySummary({
        user_id: "u1",
        month: "2026-10",
        hours: 10,
        minimum_hours: 48,
        compliance: 0.2,
        meets_minimum: false,
      }),
    ).toEqual({
      userId: "u1",
      month: "2026-10",
      hours: 10,
      minimumHours: 48,
      compliance: 0.2,
      meetsMinimum: false,
    });
    expect(
      mapMemberPoints({
        user_id: "u1",
        hour_points: 100,
        money_points: 20,
        total_points: 120,
        participation: 0.5,
      }),
    ).toEqual({
      userId: "u1",
      hourPoints: 100,
      moneyPoints: 20,
      totalPoints: 120,
      participation: 0.5,
    });
  });
});

describe("actividad", () => {
  const row: Tables<"audit_log"> = {
    id: "a1",
    seq: 7,
    occurred_at: T,
    client_at: "2026-10-03T12:00:01-05:00",
    actor_id: "u1",
    actor_role: "admin",
    event_type: "task.moved",
    entity_table: "tasks",
    entity_id: "t1",
    project_id: "p1",
    entity_label: "Tarea",
    changes: [{ field: "status", from: "todo", to: "done" }],
    before: { status: "todo" },
    after: { status: "done" },
    reason: null,
    request_id: "req-1",
    session_id: "ses-1",
    client_platform: "web",
    client_version: "0.0.0",
    prev_hash: "0",
    hash: "1",
  };

  it("mapea una entrada con el mismo contrato que el mock", () => {
    expect(mapAuditEntry(row)).toEqual({
      id: "a1",
      seq: 7,
      occurredAt: ISO,
      clientAt: "2026-10-03T17:00:01.000Z",
      actorId: "u1",
      actorRole: "admin",
      eventType: "task.moved",
      entity: { table: "tasks", id: "t1", projectId: "p1", label: "Tarea" },
      changes: [{ field: "status", from: "todo", to: "done" }],
      before: { status: "todo" },
      after: { status: "done" },
      reason: null,
      requestId: "req-1",
      sessionId: "ses-1",
      client: { platform: "web", appVersion: "0.0.0" },
    });
  });

  it("una acción del sistema (sin actor) no rompe el contrato", () => {
    const entry = mapAuditEntry({
      ...row,
      actor_id: null,
      actor_role: null,
      client_at: null,
      session_id: null,
    });
    expect(entry.actorId).toBe("system");
    expect(entry.actorRole).toBe("collaborator");
    expect(entry.clientAt).toBeNull();
    expect(entry.sessionId).toBe("");
  });

  it("una plataforma desconocida cae en web y los cambios inválidos en lista vacía", () => {
    const entry = mapAuditEntry({
      ...row,
      client_platform: "otro",
      changes: "no-es-lista" as never,
    });
    expect(entry.client.platform).toBe("web");
    expect(entry.changes).toEqual([]);
  });
});

describe("mapNotification", () => {
  const row: Tables<"notifications"> = {
    id: "n1",
    user_id: "u1",
    type: "task_assigned",
    payload: { title: "Hola", taskId: "t1", extra: 3, nested: { a: 1 }, nada: null },
    read_at: null,
    created_at: "2026-10-05T15:00:00+00:00",
  };

  it("traduce la fila al dominio y deja solo claves de texto en la carga", () => {
    expect(mapNotification(row)).toEqual({
      id: "n1",
      userId: "u1",
      type: "task_assigned",
      payload: { title: "Hola", taskId: "t1" },
      read: false,
      createdAt: "2026-10-05T15:00:00.000Z",
    });
  });

  it("read_at con fecha significa leída", () => {
    expect(mapNotification({ ...row, read_at: "2026-10-05T16:00:00+00:00" }).read).toBe(true);
  });

  it("una carga que no es objeto queda vacía", () => {
    expect(mapNotification({ ...row, payload: ["x"] }).payload).toEqual({});
    expect(mapNotification({ ...row, payload: null as never }).payload).toEqual({});
  });
});
