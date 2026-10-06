import { describe, expect, it, vi } from "vitest";
import { mapChatMessage, createChatService } from "./chat";
import type { VexaSupabase } from "@/lib/supabase";
import type { Tables } from "./database.types";
const row = {
  id: "message",
  author_id: "author",
  thread_id: "thread",
  body: "hello",
  created_at: "2026-10-06T12:00:00Z",
  edited_at: null,
  deleted_at: null,
  reply_to: null,
  attachment_path: null,
  attachment_name: null,
  attachment_mime: null,
  attachment_size: null,
} satisfies Tables<"chat_messages">;
describe("chat domain boundary", () => {
  it("maps dates and reactions without leaking database columns", () => {
    expect(mapChatMessage(row, { author: "👍" })).toEqual({
      id: "message",
      authorId: "author",
      text: "hello",
      sentAt: Date.parse(row.created_at),
      reactions: { author: "👍" },
    });
  });
  it("always clears soft-deleted content", () => {
    expect(
      mapChatMessage(
        { ...row, deleted_at: row.created_at },
        { author: "👍" },
        "https://signed.test",
      ),
    ).toMatchObject({ text: "", reactions: {}, deleted: true });
    expect(
      mapChatMessage(
        { ...row, deleted_at: row.created_at },
        {},
        "https://signed.test",
      ).attachment,
    ).toBeUndefined();
  });
  it("rejects unauthenticated calls", async () => {
    const client = {
      auth: { getSession: async () => ({ data: { session: null } }) },
    } as unknown as VexaSupabase;
    await expect(createChatService(client).listThreads()).rejects.toThrow(
      "Inicia sesión",
    );
  });
});

describe("chat RPC boundary", () => {
  it("preserves actual argument names and null group creation without studio-role gating", async () => {
    const rpc = vi.fn(async () => ({ data: "thread", error: null }));
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "collaborator" } } },
        }),
      },
      rpc,
    } as unknown as VexaSupabase;
    const service = createChatService(client);
    expect(await service.directThread("other")).toBe("thread");
    expect(rpc).toHaveBeenLastCalledWith("chat_direct_thread", {
      p_other: "other",
    });
    await service.saveGroup({
      name: "Group",
      description: "Description",
      members: ["other"],
    });
    expect(rpc).toHaveBeenLastCalledWith("chat_save_group", {
      p_id: null,
      p_name: "Group",
      p_description: "Description",
      p_members: ["other"],
    });
    await service.markRead("thread");
    expect(rpc).toHaveBeenLastCalledWith("chat_mark_read", {
      p_thread: "thread",
    });
    await service.deleteGroup("thread");
    expect(rpc).toHaveBeenLastCalledWith("chat_delete_group", {
      p_id: "thread",
    });
  });
});
