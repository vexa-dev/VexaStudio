import type { ChatMessage, ChatSettings, ChatThread } from "@vexa/domain/chat";
import type { ChatService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { normalizeWallpaper } from "@/features/chat/chat-wallpaper";
import {
  createChatMedia,
  decodeAttachment,
  CHAT_WALLPAPER_LIMIT,
  removeChatObject,
} from "./chat-media";
import { createChatRealtime } from "./chat-realtime";
import type { Tables, TablesInsert } from "./database.types";
import { toServiceError, unwrap, unwrapMaybe } from "./errors";
import { requireUserId } from "./session";

type MessageRow = Tables<"chat_messages">;
export function mapChatMessage(
  row: MessageRow,
  reactions: Record<string, string> = {},
  signedUrl?: string,
): ChatMessage {
  return {
    id: row.id,
    authorId: row.author_id,
    text: row.deleted_at ? "" : row.body,
    sentAt: Date.parse(row.created_at),
    reactions: row.deleted_at ? {} : reactions,
    ...(row.edited_at ? { editedAt: Date.parse(row.edited_at) } : {}),
    ...(row.deleted_at ? { deleted: true } : {}),
    ...(row.reply_to ? { replyTo: row.reply_to } : {}),
    ...(!row.deleted_at && row.attachment_path && signedUrl
      ? {
          attachment: {
            name: row.attachment_name!,
            type: row.attachment_mime!,
            data: signedUrl,
          },
        }
      : {}),
  };
}
const defaults: ChatSettings = {
  status: "Disponible",
  notifications: true,
  sound: "soft",
  presence: true,
  wallpaper: { kind: "none" },
  currentProjectId: null,
};
export function createChatService(client: VexaSupabase): ChatService {
  // Construct lazily so authentication failure never creates a channel or media cache.
  let media: ReturnType<typeof createChatMedia> | undefined;
  const getMedia = () => (media ??= createChatMedia(client));
  const realtime = createChatRealtime(client);
  async function access(threadId: string) {
    await requireUserId(client);
    const row = unwrapMaybe<Tables<"chat_threads">>(
      await client
        .from("chat_threads")
        .select("*")
        .eq("id", threadId)
        .maybeSingle(),
    );
    if (!row) throw new Error("No tienes acceso a esta conversación.");
    return row;
  }
  async function message(threadId: string, id: string) {
    await access(threadId);
    const row = unwrapMaybe<MessageRow>(
      await client
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
    );
    if (!row) throw new Error("El mensaje ya no está disponible.");
    return row;
  }
  async function mapRows(rows: MessageRow[]) {
    if (!rows.length) return [];
    if (rows.length > 100) {
      const messages: ChatMessage[] = [];
      for (let start = 0; start < rows.length; start += 100)
        messages.push(...(await mapRows(rows.slice(start, start + 100))));
      return messages;
    }
    const reactions = unwrap(
      await client
        .from("chat_reactions")
        .select("*")
        .in(
          "message_id",
          rows.map((row) => row.id),
        ),
    );
    const urls = await getMedia().sign(
      rows
        .filter((row) => !row.deleted_at && row.attachment_path)
        .map((row) => row.attachment_path!),
    );
    return rows.map((row) =>
      mapChatMessage(
        row,
        Object.fromEntries(
          reactions
            .filter((reaction) => reaction.message_id === row.id)
            .map((reaction) => [reaction.user_id, reaction.emoji]),
        ),
        urls.get(row.attachment_path ?? ""),
      ),
    );
  }
  async function readAllMessages(threadId: string, sharedOnly = false) {
    const rows: MessageRow[] = [];
    let cursor: MessageRow | undefined;
    for (;;) {
      let query = client
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(500);
      if (sharedOnly) query = query.is("deleted_at", null);
      if (cursor)
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
        );
      const page = unwrap(await query);
      rows.push(...page);
      if (page.length < 500) return rows;
      cursor = page.at(-1);
    }
  }
  async function insert(row: TablesInsert<"chat_messages">) {
    const result = await client
      .from("chat_messages")
      .insert(row)
      .select("*")
      .single();
    if (result.error || !result.data) {
      await removeChatObject(
        client,
        "chat-attachments",
        row.attachment_path ?? null,
      );
      throw toServiceError(
        result.error ?? { message: "El servidor no devolvió datos" },
      );
    }
    realtime.notify({ threadId: row.thread_id });
    return (await mapRows([result.data]))[0];
  }
  async function preferenceRow() {
    const userId = await requireUserId(client);
    return unwrapMaybe<Tables<"chat_preferences">>(
      await client
        .from("chat_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    );
  }
  async function writeStatus(values: TablesInsert<"chat_status">) {
    const { user_id, ...patch } = values;
    const existing = unwrapMaybe<Tables<"chat_status">>(
      await client
        .from("chat_status")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle(),
    );
    if (existing)
      unwrap(
        await client
          .from("chat_status")
          .update(patch)
          .eq("user_id", user_id)
          .select("user_id"),
      );
    else {
      const result = await client
        .from("chat_status")
        .insert(values)
        .select("user_id");
      if (result.error?.code === "23505")
        unwrap(
          await client
            .from("chat_status")
            .update(patch)
            .eq("user_id", user_id)
            .select("user_id"),
        );
      else unwrap(result);
    }
  }
  async function writePreferences(values: TablesInsert<"chat_preferences">) {
    const { user_id, ...patch } = values;
    const existing = await preferenceRow();
    if (existing)
      unwrap(
        await client
          .from("chat_preferences")
          .update(patch)
          .eq("user_id", user_id)
          .select("user_id"),
      );
    else {
      const result = await client
        .from("chat_preferences")
        .insert(values)
        .select("user_id");
      if (result.error?.code === "23505")
        unwrap(
          await client
            .from("chat_preferences")
            .update(patch)
            .eq("user_id", user_id)
            .select("user_id"),
        );
      else unwrap(result);
    }
  }
  const service: ChatService = {
    async listThreads() {
      await requireUserId(client);
      const threads = unwrap(
        await client
          .from("chat_threads")
          .select("*")
          .order("updated_at", { ascending: false }),
      );
      return Promise.all(
        threads.map(async (thread): Promise<ChatThread> => {
          const [members, reads, rows] = await Promise.all([
            client
              .from("chat_members")
              .select("user_id")
              .eq("thread_id", thread.id),
            client.from("chat_reads").select("*").eq("thread_id", thread.id),
            readAllMessages(thread.id).then((data) => ({ data, error: null })),
          ]);
          return {
            id: thread.id,
            kind: thread.kind,
            name: thread.name,
            description: thread.description,
            members: unwrap(members).map((member) => member.user_id),
            readAt: Object.fromEntries(
              unwrap(reads).map((read) => [
                read.user_id,
                Date.parse(read.read_at),
              ]),
            ),
            messages: await mapRows(unwrap(rows).reverse()),
          };
        }),
      );
    },
    async loadOlder(threadId, beforeSentAt, limit = 50) {
      await access(threadId);
      if (limit <= 0) return [];
      const rows = unwrap(
        await client
          .from("chat_messages")
          .select("*")
          .eq("thread_id", threadId)
          .lt("created_at", new Date(beforeSentAt).toISOString())
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(Math.min(limit, 500)),
      );
      return mapRows(rows.reverse());
    },
    async directThread(otherId) {
      await requireUserId(client);
      return unwrap(
        await client.rpc("chat_direct_thread", { p_other: otherId }),
      );
    },
    async saveGroup(input) {
      await requireUserId(client);
      return unwrap(
        await client.rpc("chat_save_group", {
          p_id: input.id ?? (null as unknown as string),
          p_name: input.name,
          p_description: input.description,
          p_members: input.members,
        }),
      );
    },
    async deleteGroup(id) {
      await requireUserId(client);
      const result = await client.rpc("chat_delete_group", { p_id: id });
      if (result.error) throw toServiceError(result.error);
      realtime.notify();
    },
    async sendMessage(threadId, input) {
      const userId = await requireUserId(client);
      await access(threadId);
      if (input.text.length > 4000)
        throw new Error("El mensaje puede tener hasta 4000 caracteres.");
      if (!input.text.trim() && !input.attachment)
        throw new Error("Escribe un mensaje o adjunta un archivo.");
      const id = crypto.randomUUID();
      const attachment = input.attachment
        ? await getMedia().upload(threadId, id, input.attachment)
        : {};
      return insert({
        id,
        author_id: userId,
        thread_id: threadId,
        body: input.text,
        reply_to: input.replyTo ?? null,
        ...attachment,
      });
    },
    async editMessage(threadId, id, text) {
      await message(threadId, id);
      const rows = unwrap(
        await client
          .from("chat_messages")
          .update({ body: text })
          .eq("thread_id", threadId)
          .eq("id", id)
          .is("deleted_at", null)
          .select("id"),
      );
      if (!rows.length) throw new Error("El mensaje ya no está disponible.");
      realtime.notify({ threadId });
    },
    async deleteMessage(threadId, id) {
      const row = await message(threadId, id);
      const rows = unwrap(
        await client
          .from("chat_messages")
          .update({ deleted_at: new Date().toISOString() })
          .eq("thread_id", threadId)
          .eq("id", id)
          .is("deleted_at", null)
          .select("id"),
      );
      if (!rows.length) throw new Error("El mensaje ya no está disponible.");
      await removeChatObject(client, "chat-attachments", row.attachment_path);
      realtime.notify({ threadId });
    },
    async reactToMessage(threadId, id, emoji) {
      await message(threadId, id);
      const result = await client.rpc("chat_react", {
        p_message: id,
        p_emoji: emoji,
      });
      if (result.error) throw toServiceError(result.error);
      realtime.notify({ threadId });
    },
    async forwardMessage(fromThreadId, id, toThreadId) {
      const row = await message(fromThreadId, id);
      await access(toThreadId);
      const userId = await requireUserId(client);
      const newId = crypto.randomUUID();
      let path: string | null = null;
      if (row.attachment_path) {
        path = `${toThreadId}/${newId}/${safeForwardName(row.attachment_path)}`;
        unwrap(
          await client.storage
            .from("chat-attachments")
            .copy(row.attachment_path, path),
        );
      }
      return insert({
        id: newId,
        thread_id: toThreadId,
        author_id: userId,
        body: row.body ? `Reenviado: ${row.body}` : "",
        attachment_path: path,
        attachment_name: row.attachment_name,
        attachment_mime: row.attachment_mime,
        attachment_size: row.attachment_size,
      });
    },
    async markRead(threadId) {
      await requireUserId(client);
      const result = await client.rpc("chat_mark_read", { p_thread: threadId });
      if (result.error) throw toServiceError(result.error);
      realtime.notify({ threadId });
    },
    async getSettings() {
      const userId = await requireUserId(client);
      const [status, prefs] = await Promise.all([
        client
          .from("chat_status")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        preferenceRow(),
      ]);
      const row = unwrapMaybe(status);
      return {
        ...defaults,
        ...(row
          ? {
              status: row.status,
              presence: row.presence,
              currentProjectId: row.current_project_id,
            }
          : {}),
        ...(prefs
          ? {
              notifications: prefs.notifications,
              sound: prefs.sound,
              wallpaper: normalizeWallpaper(prefs.wallpaper),
            }
          : {}),
      };
    },
    async updateSettings(patch) {
      const userId = await requireUserId(client);
      const status: TablesInsert<"chat_status"> = { user_id: userId };
      if (patch.status !== undefined)
        status.status = patch.status.trim().slice(0, 80);
      if (patch.presence !== undefined) status.presence = patch.presence;
      if (patch.currentProjectId !== undefined)
        status.current_project_id = patch.currentProjectId || null;
      const prefs: TablesInsert<"chat_preferences"> = { user_id: userId };
      if (patch.notifications !== undefined)
        prefs.notifications = patch.notifications;
      if (patch.sound !== undefined) prefs.sound = patch.sound;
      if (patch.wallpaper !== undefined)
        prefs.wallpaper = normalizeWallpaper(patch.wallpaper);
      // Write only the patched columns: concurrent unrelated changes are never overwritten.
      if (Object.keys(status).length > 1) await writeStatus(status);
      if (Object.keys(prefs).length > 1) await writePreferences(prefs);
      realtime.notify();
      return service.getSettings();
    },
    async listMemberStatus() {
      await requireUserId(client);
      const [profileResult, statusResult] = await Promise.all([
        client.from("profiles").select("id").eq("active", true),
        client.from("chat_status").select("*"),
      ]);
      const rows = new Map(
        unwrap(statusResult).map((row) => [row.user_id, row]),
      );
      return Object.fromEntries(
        unwrap(profileResult).map((profile) => {
          const row = rows.get(profile.id);
          return [
            profile.id,
            {
              status: row?.status ?? defaults.status,
              presence: row?.presence ?? defaults.presence,
              currentProjectId: row?.current_project_id ?? null,
            },
          ];
        }),
      );
    },
    async getWallpaperImage() {
      const row = await preferenceRow();
      if (!row?.wallpaper_path) return null;
      const blob = unwrap(
        await client.storage
          .from("chat-wallpapers")
          .download(row.wallpaper_path),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `data:${blob.type};base64,${btoa(binary)}`;
    },
    async saveWallpaperImage(dataUrl) {
      const userId = await requireUserId(client);
      const mime = /^data:(image\/(?:png|jpeg|webp));/.exec(dataUrl)?.[1];
      if (!mime) throw new Error("La imagen no es válida o pesa demasiado.");
      let blob: Blob;
      try {
        blob = decodeAttachment(
          { name: "wallpaper", type: mime, data: dataUrl },
          CHAT_WALLPAPER_LIMIT,
        );
      } catch (error) {
        throw new Error("La imagen no es válida o pesa demasiado.", {
          cause: error,
        });
      }
      const previous = await preferenceRow();
      const path = `${userId}/${crypto.randomUUID()}.${mime.split("/")[1]}`;
      unwrap(
        await client.storage
          .from("chat-wallpapers")
          .upload(path, blob, { contentType: mime, upsert: false }),
      );
      try {
        await writePreferences({
          user_id: userId,
          wallpaper_path: path,
          wallpaper: { kind: "image" },
        });
      } catch (error) {
        await removeChatObject(client, "chat-wallpapers", path);
        throw error;
      }
      await removeChatObject(
        client,
        "chat-wallpapers",
        previous?.wallpaper_path ?? null,
      );
      realtime.notify();
    },
    async removeWallpaperImage() {
      const userId = await requireUserId(client);
      const previous = await preferenceRow();
      await writePreferences({
        user_id: userId,
        wallpaper_path: null,
        wallpaper: { kind: "none" },
      });
      await removeChatObject(
        client,
        "chat-wallpapers",
        previous?.wallpaper_path ?? null,
      );
      realtime.notify();
    },
    async listSharedMessages(threadId) {
      await access(threadId);
      // RPC timestamp-only cursors cannot preserve ties. Stable (timestamp,id) keyset under the same table RLS avoids lost rows.
      const rows = (await readAllMessages(threadId, true)).filter(
        (row) => row.attachment_path || /https?:\/\//i.test(row.body),
      );
      return mapRows(rows);
    },
    subscribe: realtime.subscribe,
    trackPresence: realtime.trackPresence,
    subscribePresence: realtime.subscribePresence,
  };
  return service;
}
function safeForwardName(path: string) {
  return path.split("/").at(-1) || "file";
}
