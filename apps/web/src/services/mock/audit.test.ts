import { beforeEach, describe, expect, it } from "vitest";
import { getDb, migrateAuditLog, resetMock, setSessionUserId } from "./db";
import { MOCK_CLIENT, recordAudit, withRequest } from "./audit";
import { tasks, time } from "./work";

const ROBER = "u-rober";
const JHONY = "u-jhony";

beforeEach(() => {
  resetMock();
  setSessionUserId(JHONY);
});

const task = { id: "t-x", title: "Pagar dominio", projectId: "p-vexa" };

describe("recordAudit", () => {
  it("numera sin huecos y guarda actor, rol, nombre y cliente", () => {
    const first = recordAudit({
      eventType: "task.created",
      table: "tasks",
      actorId: JHONY,
      before: null,
      after: task,
    });
    const second = recordAudit({
      eventType: "task.edited",
      table: "tasks",
      actorId: ROBER,
      before: task,
      after: { ...task, title: "Pagar el dominio" },
    });
    expect([first?.seq, second?.seq]).toEqual([1, 2]);
    expect(first).toMatchObject({
      actorId: JHONY,
      actorRole: "admin",
      entity: {
        table: "tasks",
        id: "t-x",
        projectId: "p-vexa",
        label: "Pagar dominio",
      },
      client: MOCK_CLIENT,
      clientAt: null,
      reason: null,
    });
    expect(second?.actorRole).toBe("partner");
    expect(second?.changes).toEqual([
      { field: "title", from: "Pagar dominio", to: "Pagar el dominio" },
    ]);
    expect(Date.parse(first?.occurredAt ?? "")).not.toBeNaN();
  });

  it("no deja rastro de una edición sin cambios", () => {
    const entry = recordAudit({
      eventType: "task.edited",
      table: "tasks",
      actorId: JHONY,
      before: task,
      after: { ...task },
    });
    expect(entry).toBeNull();
    expect(getDb().auditLog).toHaveLength(0);
  });

  it("guarda copias: mutar el registro después no altera la entrada", () => {
    const live = { ...task };
    recordAudit({
      eventType: "task.created",
      table: "tasks",
      actorId: JHONY,
      before: null,
      after: live,
    });
    live.title = "Otro";
    expect(getDb().auditLog[0].after).toMatchObject({ title: "Pagar dominio" });
  });

  it("comparte requestId dentro de una operación y no entre operaciones", () => {
    const write = () =>
      recordAudit({
        eventType: "task.created",
        table: "tasks",
        actorId: JHONY,
        before: null,
        after: task,
      });
    withRequest(() => {
      write();
      write();
    });
    write();
    const [a, b, c] = getDb().auditLog;
    expect(a.requestId).toBe(b.requestId);
    expect(c.requestId).not.toBe(a.requestId);
  });

  it("una operación de servicio que audita varias veces usa un solo requestId", async () => {
    await time.start("t-7");
    const ids = new Set(getDb().auditLog.map((a) => a.requestId));
    expect(getDb().auditLog.length).toBeGreaterThan(1);
    expect(ids.size).toBe(1);
    await tasks.move("t-7", "review");
    expect(new Set(getDb().auditLog.map((a) => a.requestId)).size).toBe(2);
  });
});

describe("migrateAuditLog", () => {
  const profiles = [{ id: JHONY, role: "admin" as const }];
  const before = { id: "t-1", title: "A", projectId: "p-vexa", status: "todo" };

  it("convierte entradas del formato anterior en orden y con evento aproximado", () => {
    const legacy = [
      {
        id: "au-1",
        table: "tasks",
        recordId: "t-1",
        action: "create" as const,
        before: null,
        after: before,
        userId: JHONY,
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      {
        id: "au-2",
        table: "tasks",
        recordId: "t-1",
        action: "update" as const,
        before,
        after: { ...before, status: "done" },
        userId: JHONY,
        createdAt: "2026-10-01T11:00:00.000Z",
      },
      {
        id: "au-3",
        table: "time_entries",
        recordId: "h-1",
        action: "void" as const,
        before: { id: "h-1", projectId: null },
        after: { id: "h-1", projectId: null, voidReason: "Duplicado" },
        userId: "u-desconocido",
        createdAt: "2026-10-01T12:00:00.000Z",
      },
    ];
    const migrated = migrateAuditLog(legacy, profiles);
    expect(migrated.map((m) => [m.seq, m.eventType])).toEqual([
      [1, "task.created"],
      [2, "task.moved"],
      [3, "hours.voided"],
    ]);
    expect(migrated[1]).toMatchObject({
      occurredAt: "2026-10-01T11:00:00.000Z",
      actorRole: "admin",
      entity: { table: "tasks", id: "t-1", projectId: "p-vexa", label: "A" },
      changes: [{ field: "status", from: "todo", to: "done" }],
    });
    expect(migrated[2]).toMatchObject({
      actorRole: "collaborator",
      reason: "Duplicado",
    });
  });

  it("conserva las entradas que ya tienen el formato nuevo", () => {
    const entry = recordAudit({
      eventType: "task.created",
      table: "tasks",
      actorId: JHONY,
      before: null,
      after: before,
    });
    expect(migrateAuditLog(entry ? [entry] : [], profiles)).toEqual([entry]);
  });
});
