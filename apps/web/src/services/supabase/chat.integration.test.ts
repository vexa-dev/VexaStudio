/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabaseClient, type VexaSupabase } from "@/lib/supabase";
import { createChatService } from "./chat";
import type { Tables } from "./database.types";
import { unwrap } from "./errors";
import type { ChatService } from "@vexa/services";
const url = import.meta.env.SUPABASE_URL as string | undefined;
const key = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
if (
  url &&
  (!/^https?:$/.test(new URL(url).protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
)
  throw new Error("Local integration requires a loopback Supabase URL");
const ROBER = "00000000-0000-4000-8000-000000000002";
const ALEX = "00000000-0000-4000-8000-000000000005";
const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNwAAAABJRU5ErkJggg==";
async function joined(channel: ReturnType<VexaSupabase["channel"]>) {
  return new Promise<void>((resolve, reject) => {
    channel.subscribe((state, error) => {
      if (state === "SUBSCRIBED") resolve();
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT")
        reject(error ?? new Error(state));
    }, 4000);
  });
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
describe.skipIf(!url || !key)("local chat integration", () => {
  const clients: VexaSupabase[] = [];
  let admin: ChatService, rober: ChatService, alex: ChatService;
  let group: string, target: string, direct: string;
  let baselineCaptured = false;
  let originalStatus: Tables<"chat_status">[] = [];
  let originalPreferences: Tables<"chat_preferences">[] = [];
  let existingDirect: string | undefined;
  const uploads: string[] = [];
  async function login(email: string) {
    const client = createSupabaseClient(url!, key!, { persistSession: false });
    clients.push(client);
    const result = await client.auth.signInWithPassword({
      email,
      password: "vexa-local-dev",
    });
    if (result.error) throw result.error;
    return createChatService(client);
  }
  beforeAll(async () => {
    admin = await login("jhony@vexa.test");
    rober = await login("rober@vexa.test");
    alex = await login("alex@vexa.test");
    originalStatus = unwrap(
      await clients[1]
        .from("chat_status")
        .select("*")
        .in("user_id", [ROBER, ALEX]),
    );
    originalPreferences = [
      ...unwrap(
        await clients[1]
          .from("chat_preferences")
          .select("*")
          .eq("user_id", ROBER),
      ),
      ...unwrap(
        await clients[2]
          .from("chat_preferences")
          .select("*")
          .eq("user_id", ALEX),
      ),
    ];
    existingDirect = (await rober.listThreads()).find(
      (thread) => thread.kind === "direct" && thread.members.includes(ALEX),
    )?.id;
    baselineCaptured = true;
    group = await admin.saveGroup({
      name: `Adapter ${crypto.randomUUID()}`,
      description: "Disposable local verification",
      members: [ROBER, ALEX],
    });
    target = await admin.saveGroup({
      name: "Forward target",
      description: "",
      members: [ROBER],
    });
  });
  afterAll(async () => {
    // Exact captured baseline rows and generated thread ids only; no reset or cloud credential.
    // Authenticated roles cannot DELETE preferences/status/direct threads, so local privileged
    // cleanup is required to restore absent rows rather than leaving artificial defaults behind.
    try {
      if (!baselineCaptured) return;
      if (uploads.length)
        await clients[1].storage.from("chat-attachments").remove(uploads);
      const ids = [group, target, !existingDirect ? direct : undefined].filter(
        Boolean,
      );
      const quote = (value: unknown) =>
        `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
      const restore = (table: string, rows: unknown[]) =>
        rows
          .map(
            (row) =>
              `insert into public.${table} select (jsonb_populate_record(null::public.${table}, ${quote(row)})).*;`,
          )
          .join("\n");
      const sql = `begin;
        delete from public.chat_threads where id in (${ids.length ? ids.map((id) => `'${id}'`).join(",") : "null"});
        delete from public.chat_status where user_id in ('${ROBER}','${ALEX}');
        delete from public.chat_preferences where user_id in ('${ROBER}','${ALEX}');
        ${restore("chat_status", originalStatus)}
        ${restore("chat_preferences", originalPreferences)}
        commit;`;
      execFileSync(
        "docker",
        [
          "--host",
          "unix:///Users/leosle/.docker/run/docker.sock",
          "exec",
          "-i",
          "supabase_db_vexa-studio",
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        { input: sql, stdio: ["pipe", "pipe", "pipe"] },
      );
    } finally {
      for (const client of clients) {
        await client.removeAllChannels();
        await client.auth.signOut();
      }
    }
  });
  it("preserves group administration and active collaborator access", async () => {
    expect(
      (await alex.listThreads()).some((thread) => thread.id === group),
    ).toBe(true);
    await expect(
      rober.saveGroup({ name: "Denied", description: "", members: [ROBER] }),
    ).rejects.toThrow("administradores");
    await expect(alex.sendMessage(target, { text: "Denied" })).rejects.toThrow(
      "acceso",
    );
  });
  it("creates idempotent private direct threads without exposing them to the administrator", async () => {
    direct = await rober.directThread(ALEX);
    expect(await alex.directThread(ROBER)).toBe(direct);
    expect(
      (await admin.listThreads()).some((thread) => thread.id === direct),
    ).toBe(false);
    await expect(admin.loadOlder(direct, Date.now())).rejects.toThrow("acceso");
  });
  it("persists messages, replies, reaction toggles, edits, read maps and soft deletes", async () => {
    const first = await rober.sendMessage(group, { text: "  hello  " });
    expect(first.text).toBe("hello");
    await alex.sendMessage(group, { text: "reply", replyTo: first.id });
    await alex.reactToMessage(group, first.id, "👍");
    expect(
      (await rober.listThreads())
        .find((thread) => thread.id === group)
        ?.messages.find((message) => message.id === first.id)?.reactions[ALEX],
    ).toBe("👍");
    await alex.reactToMessage(group, first.id, "👍");
    await rober.editMessage(group, first.id, "edited");
    await expect(alex.editMessage(group, first.id, "denied")).rejects.toThrow();
    await alex.markRead(group);
    expect(
      (await rober.listThreads()).find((thread) => thread.id === group)?.readAt[
        ALEX
      ],
    ).toBeGreaterThan(0);
    await admin.deleteMessage(group, first.id);
    await expect(rober.editMessage(group, first.id, "again")).rejects.toThrow(
      "disponible",
    );
    const older = await rober.loadOlder(group, Date.now() + 1000);
    expect(older.find((message) => message.id === first.id)).toMatchObject({
      text: "",
      deleted: true,
      reactions: {},
    });
  });
  it("uploads immutable private attachments, signs, copies with target ownership and cleans failed inserts", async () => {
    const sent = await rober.sendMessage(group, {
      text: "https://example.test",
      attachment: {
        name: "../notes.txt",
        type: "text/plain",
        data: "data:text/plain;base64,aGk=",
      },
    });
    expect(sent.attachment?.data).toContain("/object/sign/");
    const forwarded = await rober.forwardMessage(group, sent.id, target);
    expect(forwarded.text).toBe("Reenviado: https://example.test");
    expect(forwarded.replyTo).toBeUndefined();
    const copiedByAlex = await alex.forwardMessage(group, sent.id, group);
    const alexPath = (
      await clients[2]
        .from("chat_messages")
        .select("attachment_path")
        .eq("id", copiedByAlex.id)
        .single()
    ).data!.attachment_path!;
    // COPY ownership belongs to the authenticated caller, not the source object's author.
    await clients[1].storage.from("chat-attachments").remove([alexPath]);
    expect(
      (await clients[2].storage.from("chat-attachments").download(alexPath))
        .error,
    ).toBeNull();
    await alex.deleteMessage(group, copiedByAlex.id);
    expect(
      (await clients[2].storage.from("chat-attachments").download(alexPath))
        .error,
    ).not.toBeNull();
    const paths = (
      await clients[1]
        .from("chat_messages")
        .select("attachment_path")
        .in("id", [sent.id, forwarded.id])
    ).data!;
    uploads.push(...paths.map((row) => row.attachment_path!));
    expect(uploads.every((path) => path.split("/").length === 3)).toBe(true);
    expect(
      (await rober.listSharedMessages(group)).some(
        (message) => message.id === sent.id,
      ),
    ).toBe(true);
    await expect(
      rober.sendMessage(target, {
        text: "bad reply",
        replyTo: sent.id,
        attachment: {
          name: "bad.txt",
          type: "text/plain",
          data: "data:text/plain;base64,aGk=",
        },
      }),
    ).rejects.toThrow("original");
    const targetObjects = await clients[1].storage
      .from("chat-attachments")
      .list(target);
    expect(targetObjects.data?.length).toBe(1);
    // Administrator can soft-delete another author's attachment even when object DELETE is denied.
    await admin.deleteMessage(group, sent.id);
    expect(
      (await clients[1].storage.from("chat-attachments").download(uploads[0]))
        .error,
    ).toBeNull();
  });
  it("preserves all shared history across timestamp ties and page boundaries", async () => {
    const ids = Array.from({ length: 501 }, () => crypto.randomUUID());
    const result = await clients[1].from("chat_messages").insert(
      ids.map((id) => ({
        id,
        thread_id: group,
        author_id: ROBER,
        body: "https://pagination.test",
      })),
    );
    expect(result.error).toBeNull();
    const shared = await rober.listSharedMessages(group);
    expect(ids.every((id) => shared.some((message) => message.id === id))).toBe(
      true,
    );
    expect(new Set(shared.map((message) => message.id)).size).toBe(
      shared.length,
    );
    // Thread snapshots retain all unread messages rather than silently truncating at 50.
    expect(
      (await alex.listThreads()).find((thread) => thread.id === group)?.messages
        .length,
    ).toBeGreaterThan(500);
  });
  it("preserves settings patches and private preferences", async () => {
    const beforeAlex = await alex.getSettings();
    await rober.updateSettings({ notifications: false, status: "  Busy  " });
    await rober.updateSettings({ sound: "none" });
    expect(await rober.getSettings()).toMatchObject({
      notifications: false,
      status: "Busy",
      sound: "none",
    });
    expect(await alex.getSettings()).toEqual(beforeAlex);
    expect(
      (
        await clients[0]
          .from("chat_preferences")
          .select("*")
          .eq("user_id", ROBER)
      ).data,
    ).toEqual([]);
  });
  it("round-trips a private wallpaper without touching the existing wallpaper", async () => {
    // Test Alex only if there is no existing wallpaper; otherwise use storage upload/read boundary directly.
    const existing = (
      await clients[2]
        .from("chat_preferences")
        .select("*")
        .eq("user_id", ALEX)
        .maybeSingle()
    ).data;
    if (existing?.wallpaper_path)
      throw new Error(
        "Disposable wallpaper test requires no pre-existing Alex wallpaper",
      );
    const settings = await alex.getSettings();
    try {
      await alex.saveWallpaperImage(tinyPng);
      expect(await alex.getWallpaperImage()).toBe(tinyPng);
      expect(
        (
          await clients[1].storage
            .from("chat-wallpapers")
            .download(
              (
                await clients[2]
                  .from("chat_preferences")
                  .select("wallpaper_path")
                  .eq("user_id", ALEX)
                  .single()
              ).data!.wallpaper_path!,
            )
        ).error,
      ).not.toBeNull();
      await alex.removeWallpaperImage();
      expect(await alex.getWallpaperImage()).toBeNull();
    } finally {
      await alex.removeWallpaperImage();
      await alex.updateSettings(settings);
    }
  });
  it("private presence binds sender identity to JWT topics and ignores payload identity", async () => {
    let online: Record<string, number> = {};
    const stop = rober.subscribePresence((value) => {
      online = value;
    });
    alex.trackPresence(true);
    try {
      for (let i = 0; i < 60 && !online[ALEX]; i++) await wait(100);
      expect(online[ALEX]).toBeGreaterThan(0);
      expect(online[ALEX]).toBeLessThanOrEqual(Date.now());
      alex.trackPresence(false);
      for (let i = 0; i < 40 && online[ALEX]; i++) await wait(100);
      expect(online[ALEX]).toBeUndefined();
      // Active reader can join another user's topic, but cannot publish presence there.
      const spoof = clients[0].channel(`chat-presence:${ALEX}`, {
        config: { private: true, presence: { enabled: true } },
      });
      await joined(spoof);
      await spoof.track({ userId: ALEX, at: Date.now() + 99999999 });
      await wait(500);
      expect(online[ALEX]).toBeUndefined();
      await clients[0].removeChannel(spoof);
      // A public channel with exactly the same topic belongs to a different namespace.
      const anon = createSupabaseClient(url!, key!, { persistSession: false });
      clients.push(anon);
      const publicSpoof = anon.channel(`chat-presence:${ALEX}`, {
        config: { presence: { enabled: true } },
      });
      await joined(publicSpoof);
      await publicSpoof.track({ userId: ALEX, at: Date.now() + 99999999 });
      await wait(500);
      expect(online[ALEX]).toBeUndefined();
      await anon.removeChannel(publicSpoof);
      const forbidden = anon.channel(`chat-presence:${ROBER}`, {
        config: { private: true, presence: { enabled: true } },
      });
      await expect(joined(forbidden)).rejects.toThrow();
      await anon.removeChannel(forbidden);
    } finally {
      alex.trackPresence(false);
      stop();
      await wait(300);
    }
    expect(clients[1].getChannels()).toHaveLength(0);
    expect(clients[2].getChannels()).toHaveLength(0);
  }, 15000);
  it("keeps presence always on and releases channel lifecycle", async () => {
    let online: Record<string, number> = {};
    const stop = rober.subscribePresence((value) => {
      online = value;
    });
    alex.trackPresence(true);
    try {
      for (let i = 0; i < 60 && !online[ALEX]; i++) await wait(100);
      expect(online[ALEX]).toBeGreaterThan(0);
      // Presence can no longer be turned off: the request is ignored and the person stays online.
      const next = await alex.updateSettings({ presence: false });
      expect(next.presence).toBe(true);
      await wait(1500);
      expect(online[ALEX]).toBeGreaterThan(0);
    } finally {
      alex.trackPresence(false);
      stop();
      await wait(300);
    }
    expect(clients[1].getChannels()).toHaveLength(0);
    expect(clients[2].getChannels()).toHaveLength(0);
  }, 22000);
  it("receives cross-session table events and unsubscribe releases channels", async () => {
    let events = 0;
    const stop = alex.subscribe(() => {
      events++;
    });
    await wait(2500);
    await rober.sendMessage(group, { text: "Realtime receive" });
    for (let i = 0; i < 30 && events === 0; i++) await wait(100);
    expect(events).toBeGreaterThan(0);
    stop();
    await wait(300);
    expect(clients[2].getChannels()).toHaveLength(0);
    const count = events;
    await rober.sendMessage(group, { text: "Unsubscribed" });
    await wait(500);
    expect(events).toBe(count);
  });
});
