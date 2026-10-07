import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, save, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(resetMock);
const services = createMockServices();
const TASK = "t-5";

describe("mock comments", () => {
  it("lists a thread oldest first and returns independent copies", async () => {
    setSessionUserId("u-rober");
    const thread = await services.comments.list("task", TASK);
    expect(thread.map((c) => c.id)).toEqual(["c-1", "c-2"]);
    thread[0].text = "changed";
    expect(getDb().comments[0].text).not.toBe("changed");
  });

  it("adds a trimmed comment as the signed-in person and persists it", async () => {
    setSessionUserId("u-diego");
    const added = await services.comments.add({ entity: "task", entityId: TASK, text: "  Hecho  " });
    expect(added).toMatchObject({ userId: "u-diego", text: "Hecho", mentions: [] });
    expect((await services.comments.list("task", TASK)).at(-1)?.id).toBe(added.id);
    expect(getDb().comments.some((c) => c.id === added.id)).toBe(true);
  });

  it("validates the text and requires a session", async () => {
    setSessionUserId("u-diego");
    await expect(services.comments.add({ entity: "task", entityId: TASK, text: "  " })).rejects.toThrow("vacío");
    await expect(
      services.comments.add({ entity: "task", entityId: TASK, text: "x".repeat(2001) }),
    ).rejects.toThrow("2000");
    setSessionUserId(null);
    await expect(services.comments.list("task", TASK)).rejects.toThrow("sesión");
  });

  it("cleans mentions and notifies each mentioned person once, never the author", async () => {
    setSessionUserId("u-jose");
    const before = getDb().notifications.length;
    const added = await services.comments.add({
      entity: "task",
      entityId: TASK,
      text: "@rober @rober @jose @alex",
      mentions: ["u-rober", "u-rober", "u-jose", "u-demo-collaborator", "u-fantasma"],
    });
    // Alex es miembro del proyecto Vexa Studio: ve la tarea. El autor y el id desconocido se descartan.
    expect(added.mentions).toEqual(["u-rober", "u-demo-collaborator"]);
    const created = getDb().notifications.slice(before);
    expect(created.map((n) => [n.userId, n.type])).toEqual([
      ["u-rober", "mention"],
      ["u-demo-collaborator", "mention"],
    ]);
    expect(created[0].payload).toMatchObject({ taskId: TASK, commentId: added.id, actorName: "José Gónzales" });
  });

  it("drops mentions of people who cannot read the entity", async () => {
    const db = getDb();
    db.tasks.push({
      id: "t-hidden",
      title: "Solo Fivuza",
      projectId: "p-fivuza",
      sprintId: null,
      assigneeId: "u-rober",
      estimateHours: 1,
      status: "todo",
      link: null,
    });
    save();
    setSessionUserId("u-rober");
    const added = await services.comments.add({
      entity: "task",
      entityId: "t-hidden",
      text: "@alex",
      mentions: ["u-demo-collaborator"],
    });
    expect(added.mentions).toEqual([]);
  });

  it("hides threads and refuses comments on entities the person cannot read", async () => {
    setSessionUserId("u-demo-collaborator");
    expect(await services.comments.list("expense", "e-2")).toEqual([]);
    await expect(
      services.comments.add({ entity: "expense", entityId: "e-2", text: "colado" }),
    ).rejects.toThrow("Tu rol no permite esta acción");
    setSessionUserId("u-rober");
    expect((await services.comments.list("expense", "e-2")).length).toBeGreaterThan(0);
  });

  it("lets reviewers and tagged people comment on someone else's hours entry", async () => {
    const entry = getDb().timeEntries.find((e) => !e.draft && e.userId === "u-rober");
    if (!entry) throw new Error("seed sin horas de Rober");
    entry.participants = [{ userId: "u-demo-collaborator", sharePercent: 50 }];
    save();
    setSessionUserId("u-jose");
    const objection = await services.comments.add({
      entity: "time_entry",
      entityId: entry.id,
      text: "Objeción: falta detalle",
      mentions: ["u-rober", "u-demo-collaborator"],
    });
    expect(objection.mentions).toEqual(["u-rober", "u-demo-collaborator"]);
    setSessionUserId("u-demo-collaborator");
    expect(await services.comments.list("time_entry", entry.id)).toHaveLength(1);
    setSessionUserId("u-demo-collaborator");
    const other = getDb().timeEntries.find((e) => !e.draft && e.userId === "u-diego");
    if (other) expect(await services.comments.list("time_entry", other.id)).toEqual([]);
  });
});
