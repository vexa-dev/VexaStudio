import { beforeEach, describe, expect, it } from "vitest";
import { recordAudit } from "./audit";
import { getDb, resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

const JHONY = "u-jhony";
const ROBER = "u-rober";
const JOSE = "u-jose";
const DIEGO = "u-diego";
const ALEX = "u-demo-collaborator";

const { audit } = createMockServices();

function log(
  actorId: string,
  projectId: string | null,
  title: string,
  eventType: "task.created" | "task.moved" = "task.created",
) {
  recordAudit({
    eventType,
    table: "tasks",
    actorId,
    before: null,
    after: { id: `t-${title}`, title, projectId },
  });
}

beforeEach(() => {
  resetMock();
  const db = getDb();
  db.projects.find((p) => p.id === "p-vexa")!.memberIds = [
    JHONY,
    ROBER,
    JOSE,
    DIEGO,
    ALEX,
  ];
  db.projects.find((p) => p.id === "p-fivuza")!.memberIds = [JHONY, ROBER];
  db.auditLog = [];
  log(JHONY, "p-vexa", "a");
  log(ROBER, "p-fivuza", "b");
  log(DIEGO, "p-fivuza", "c", "task.moved");
  log(JOSE, null, "d");
  log(ALEX, "p-vexa", "e");
  setSessionUserId(JHONY);
});

const titles = async (...args: Parameters<typeof audit.list>) =>
  (await audit.list(...args)).items.map((e) => e.entity.label);

describe("visibilidad", () => {
  it("el admin ve todo, de lo más reciente a lo más antiguo", async () => {
    expect(await titles()).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("un socio ve sus proyectos y sus propias acciones", async () => {
    setSessionUserId(ROBER);
    expect(await titles()).toEqual(["e", "c", "b", "a"]);
    setSessionUserId(DIEGO);
    // Diego no es miembro de Fivuza, pero ve lo que hizo él mismo.
    expect(await titles()).toEqual(["e", "c", "a"]);
    setSessionUserId(JOSE);
    expect(await titles()).toEqual(["e", "d", "a"]);
  });

  it("un colaborador solo ve sus acciones", async () => {
    setSessionUserId(ALEX);
    expect(await titles()).toEqual(["e"]);
  });

  it("exige sesión", async () => {
    setSessionUserId(null);
    await expect(audit.list()).rejects.toThrow("Inicia sesión");
    await expect(audit.timeline({ table: "tasks", id: "t-a" })).rejects.toThrow(
      "Inicia sesión",
    );
  });

  it("la línea de tiempo respeta la misma visibilidad", async () => {
    log(ROBER, "p-fivuza", "b", "task.moved");
    expect(
      (await audit.timeline({ table: "tasks", id: "t-b" })).map(
        (e) => e.eventType,
      ),
    ).toEqual(["task.moved", "task.created"]);
    setSessionUserId(ALEX);
    expect(await audit.timeline({ table: "tasks", id: "t-b" })).toEqual([]);
  });
});

describe("paginación y filtros", () => {
  it("pagina por seq sin repetir ni saltarse entradas", async () => {
    const first = await audit.list({}, null, 2);
    expect(first.items.map((e) => e.seq)).toEqual([5, 4]);
    expect(first.nextCursor).toBe(4);
    const second = await audit.list({}, first.nextCursor, 2);
    expect(second.items.map((e) => e.seq)).toEqual([3, 2]);
    const third = await audit.list({}, second.nextCursor, 2);
    expect(third.items.map((e) => e.seq)).toEqual([1]);
    expect(third.nextCursor).toBeNull();
  });

  it("una página exacta no anuncia una página vacía", async () => {
    expect((await audit.list({}, null, 5)).nextCursor).toBeNull();
  });

  it("filtra por actor, proyecto, registro y tipo de evento", async () => {
    expect(await titles({ actorId: ROBER })).toEqual(["b"]);
    expect(await titles({ projectId: "p-fivuza" })).toEqual(["c", "b"]);
    expect(await titles({ entityTable: "tasks", entityId: "t-d" })).toEqual([
      "d",
    ]);
    expect(await titles({ eventTypes: ["task.moved"] })).toEqual(["c"]);
    expect(await titles({ eventTypes: [] })).toHaveLength(5);
  });

  it("filtra por rango de fecha de ocurrencia, extremos incluidos", async () => {
    getDb().auditLog.forEach((e, i) => {
      e.occurredAt = `2026-10-0${i + 1}T12:00:00.000Z`;
    });
    expect(
      await titles({
        from: "2026-10-02T12:00:00.000Z",
        to: "2026-10-04T12:00:00.000Z",
      }),
    ).toEqual(["d", "c", "b"]);
  });

  it("aplica el filtro antes de paginar", async () => {
    const page = await audit.list({ projectId: "p-vexa" }, null, 1);
    expect(page.items.map((e) => e.entity.label)).toEqual(["e"]);
    expect(page.nextCursor).toBe(5);
  });
});
