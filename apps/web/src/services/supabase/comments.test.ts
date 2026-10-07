import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok } from "./fake-client";
import { createCommentService } from "./comments";

const row = {
  id: "c1",
  entity: "task",
  entity_id: "t1",
  user_id: "u1",
  text: "Hola @rober",
  mentions: ["u2"],
  created_at: "2026-10-07T20:00:00+00:00",
};

describe("CommentService de Supabase", () => {
  it("lists the thread of one entity oldest first", async () => {
    const { client, calls } = fakeClient({ tables: { comments: ok([row]) } });
    const list = await createCommentService(client).list("task", "t1");
    expect(list).toEqual([
      {
        id: "c1",
        entity: "task",
        entityId: "t1",
        userId: "u1",
        text: "Hola @rober",
        mentions: ["u2"],
        createdAt: "2026-10-07T20:00:00.000Z",
      },
    ]);
    expect(argsOf(calls, "comments", "eq")).toEqual([["entity", "task"], ["entity_id", "t1"]]);
    expect(argsOf(calls, "comments", "order")[0]).toEqual(["created_at", { ascending: true }]);
  });

  it("requires a session", async () => {
    const { client } = fakeClient({ userId: null });
    await expect(createCommentService(client).list("task", "t1")).rejects.toThrow("Inicia sesión");
  });

  it("inserts the trimmed text with unique mentions and never sends user_id", async () => {
    const { client, calls } = fakeClient({ tables: { comments: ok(row) } });
    await createCommentService(client).add({
      entity: "task",
      entityId: "t1",
      text: "  Hola @rober ",
      mentions: ["u2", "u2"],
    });
    expect(argsOf(calls, "comments", "insert")[0]).toEqual([
      { entity: "task", entity_id: "t1", text: "Hola @rober", mentions: ["u2"] },
    ]);
  });

  it("validates before the network and translates database errors", async () => {
    const empty = fakeClient();
    await expect(
      createCommentService(empty.client).add({ entity: "task", entityId: "t1", text: "  " }),
    ).rejects.toThrow("vacío");
    expect(empty.calls).toHaveLength(0);
    const denied = fakeClient({
      tables: { comments: { data: null, error: { message: "new row violates row-level security policy", code: "42501" } } },
    });
    await expect(
      createCommentService(denied.client).add({ entity: "task", entityId: "t1", text: "a" }),
    ).rejects.toThrow("Tu rol no permite esta acción");
  });
});
