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
  attachment_purged_at: null,
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
    await service.markDelivered("thread");
    expect(rpc).toHaveBeenLastCalledWith("chat_mark_delivered", {
      p_thread: "thread",
    });
    await service.deleteGroup("thread");
    expect(rpc).toHaveBeenLastCalledWith("chat_delete_group", {
      p_id: "thread",
    });
  });
});

describe("chat delivery marks", () => {
  it("maps delivered_at next to read_at and skips null marks", async () => {
    const tables: Record<string, unknown[]> = {
      chat_threads: [
        {
          id: "thread",
          kind: "direct",
          name: "",
          description: "",
          updated_at: "2026-10-06T12:00:00Z",
        },
      ],
      chat_members: [{ user_id: "ana" }, { user_id: "beto" }],
      chat_reads: [
        {
          thread_id: "thread",
          user_id: "ana",
          read_at: "2026-10-06T12:00:00Z",
          delivered_at: null,
        },
        {
          thread_id: "thread",
          user_id: "beto",
          read_at: null,
          delivered_at: "2026-10-06T12:00:05Z",
        },
      ],
    };
    const query = (table: string) => {
      const chain: Record<string, unknown> = {};
      const result = { data: tables[table] ?? [], error: null };
      for (const name of ["select", "eq", "order", "limit", "lt", "range"])
        chain[name] = () => chain;
      chain.then = (resolve: (value: typeof result) => unknown) =>
        resolve(result);
      return chain;
    };
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "ana" } } },
        }),
      },
      from: query,
    } as unknown as VexaSupabase;
    const [thread] = await createChatService(client).listThreads();
    expect(thread?.readAt).toEqual({ ana: Date.parse("2026-10-06T12:00:00Z") });
    expect(thread?.deliveredAt).toEqual({
      beto: Date.parse("2026-10-06T12:00:05Z"),
    });
  });
});

type Result = { data?: unknown; error: { message: string } | null };
/** Chainable, awaitable query fake: every call returns itself and awaiting yields `result`. */
function query(result: Result) {
  const self: Record<string, unknown> = {};
  for (const name of ["select", "eq", "is", "update", "in", "order", "limit"])
    self[name] = vi.fn(() => self);
  self.maybeSingle = vi.fn(async () => result);
  self.then = (resolve: (value: Result) => unknown) =>
    Promise.resolve(result).then(resolve);
  return self;
}
const stateRow = (
  user: string,
  keep: boolean | null,
): Tables<"chat_attachment_states"> => ({
  message_id: "message",
  user_id: user,
  downloaded_at: "2026-10-06T12:01:00Z",
  keep,
  answered_at: keep === null ? null : "2026-10-06T12:02:00Z",
});
const withFile = {
  ...row,
  body: "",
  attachment_path: "thread/message/f.pdf",
  attachment_name: "f.pdf",
  attachment_mime: "application/pdf",
  attachment_size: 100,
} satisfies Tables<"chat_messages">;

describe("chat attachment lifecycle mapping", () => {
  it("maps downloads and answers per member next to the signed file", () => {
    expect(
      mapChatMessage(withFile, {}, "https://signed.test", [
        stateRow("beto", null),
        stateRow("caro", false),
      ]),
    ).toMatchObject({
      attachment: { name: "f.pdf", size: 100, data: "https://signed.test" },
      attachmentLife: {
        downloadedAt: {
          beto: Date.parse("2026-10-06T12:01:00Z"),
          caro: Date.parse("2026-10-06T12:01:00Z"),
        },
        keep: { caro: false },
      },
    });
  });
  it("turns a purged file into a text placeholder and never a link", () => {
    const mapped = mapChatMessage(
      { ...withFile, attachment_purged_at: "2026-10-06T13:00:00Z" },
      {},
      "https://signed.test",
      [],
    );
    expect(mapped.attachment).toBeUndefined();
    expect(mapped.purgedAttachment).toEqual({
      name: "f.pdf",
      type: "application/pdf",
      size: 100,
      purgedAt: Date.parse("2026-10-06T13:00:00Z"),
    });
    expect(mapped.deleted).toBeUndefined();
  });
  it("a message without a file carries no lifecycle", () => {
    expect(mapChatMessage(row, {}, undefined, [])).not.toHaveProperty(
      "attachmentLife",
    );
  });
});

describe("chat attachment lifecycle calls", () => {
  function setup(
    rpcResult: Result,
    extra: Partial<Record<string, unknown>> = {},
  ) {
    const rpc = vi.fn(async () => rpcResult);
    const remove = vi.fn(async () => ({ data: [{}], error: null }));
    const update = query({ data: [{ id: "message" }], error: null });
    const from = vi.fn((table: string) =>
      table === "chat_messages" && !extra.noRow
        ? Object.assign(query({ data: null, error: null }), {
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "message",
                thread_id: "thread",
                attachment_path: "thread/message/f.pdf",
                attachment_purged_at: null,
              },
              error: null,
            })),
            update: vi.fn(() => update),
          })
        : query({ data: [], error: null }),
    );
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "beto" } } },
        }),
      },
      rpc,
      from,
      storage: { from: vi.fn(() => ({ remove: extra.remove ?? remove })) },
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    } as unknown as VexaSupabase;
    return { service: createChatService(client), rpc, remove, from, update };
  }

  it("records my download through the RPC", async () => {
    const { service, rpc } = setup({ data: null, error: null });
    await service.markAttachmentDownloaded("message");
    expect(rpc).toHaveBeenCalledWith("chat_mark_attachment_downloaded", {
      p_message: "message",
    });
  });
  it("answering keep never removes the file", async () => {
    const { service, rpc, remove } = setup({ data: false, error: null });
    await service.answerAttachmentKeep("message", true);
    expect(rpc).toHaveBeenCalledWith("chat_answer_attachment_keep", {
      p_message: "message",
      p_keep: true,
    });
    expect(remove).not.toHaveBeenCalled();
  });
  it("releasing while someone still has to answer does not remove it", async () => {
    const { service, remove } = setup({ data: false, error: null });
    await service.answerAttachmentKeep("message", false);
    expect(remove).not.toHaveBeenCalled();
  });
  it("the release that completes everybody's removes the object and records the purge", async () => {
    const { service, remove, update } = setup({ data: true, error: null });
    await service.answerAttachmentKeep("message", false);
    expect(remove).toHaveBeenCalledWith(["thread/message/f.pdf"]);
    expect(update.is).toHaveBeenCalledWith("attachment_purged_at", null);
  });
  it("a Storage failure does not fail the answer and records no purge", async () => {
    const failing = vi.fn(async () => ({
      data: null,
      error: { message: "boom" },
    }));
    const { service, update } = setup(
      { data: true, error: null },
      { remove: failing },
    );
    await expect(
      service.answerAttachmentKeep("message", false),
    ).resolves.toBeUndefined();
    expect(update.is).not.toHaveBeenCalled();
  });
  it("an RPC error reaches the caller and nothing is removed", async () => {
    const { service, remove } = setup({
      data: null,
      error: { message: "Ya respondiste sobre este archivo." },
    });
    await expect(
      service.answerAttachmentKeep("message", false),
    ).rejects.toThrow("Ya respondiste");
    expect(remove).not.toHaveBeenCalled();
  });
  it("the retry only removes what the server says is purgeable", async () => {
    const no = setup({ data: false, error: null });
    await no.service.purgeReleasedAttachment("message");
    expect(no.rpc).toHaveBeenCalledWith("chat_attachment_purgeable", {
      p_message: "message",
    });
    expect(no.remove).not.toHaveBeenCalled();
    const yes = setup({ data: true, error: null });
    await yes.service.purgeReleasedAttachment("message");
    expect(yes.remove).toHaveBeenCalledOnce();
  });
});
