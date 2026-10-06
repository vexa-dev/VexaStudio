import type { ChatEvent } from "@vexa/domain/chat";
import type { Id, Profile } from "@vexa/domain/types";
import type { ChatService } from "@vexa/services";
import {
  CHAT_KEY,
  CHAT_UPDATE_EVENT,
  canOpenThread,
  changeMessage,
  chatSettingsFor,
  deleteGroup,
  directThread,
  forwardMessage,
  patchChatSettings,
  reactToMessage,
  readChatStore,
  readThread,
  requireThread,
  saveGroup,
  sendMessage,
  writeChatStore,
  type ChatStore,
} from "@/features/chat/chat-store";
import {
  clearWallpaperImage,
  readWallpaperImage,
  writeWallpaperImage,
} from "@/features/chat/chat-wallpaper";
import { collectSharedMedia } from "@/features/chat/shared-media";
import { getDb, getSessionUserId } from "./db";
import { delay } from "./utils";

/*
 * Mock chat: the pure rules in `chat-store.ts` over the same localStorage blob
 * (`vexa.chat-preview.v1`) the chat has always used, behind the async contract.
 * Changes reach other tabs through the `storage` event and this tab through
 * `vexa-chat-update`.
 */

const PRESENCE_PREFIX = "vexa.chat-presence.";
const WALLPAPER_PREFIX = "vexa.chat-wallpaper.";
const BEAT_MS = 15_000;
const PRESENCE_TTL_MS = 45_000;
const OLDER_PAGE = 50;

function actor(): Profile {
  const id = getSessionUserId();
  const profile = getDb().profiles.find((p) => p.id === id && p.active);
  if (!profile) throw new Error("Inicia sesión para usar el chat.");
  return profile;
}

function emit() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(CHAT_UPDATE_EVENT));
}

/** Reads the blob, applies a rule and saves it only when `change` says so. */
function mutate<T>(
  change: (store: ChatStore, user: Profile) => T,
  changed: (result: T) => boolean = () => true,
): T {
  const user = actor();
  const store = readChatStore();
  const result = change(store, user);
  if (changed(result)) {
    try {
      writeChatStore(store);
    } catch {
      throw new Error("No se pudo guardar la vista previa del chat.");
    }
  }
  return result;
}

function lastMessage(store: ChatStore, threadId: Id) {
  const message = store.threads
    .find((thread) => thread.id === threadId)
    ?.messages.at(-1);
  if (!message) throw new Error("No se pudo guardar la vista previa del chat.");
  return message;
}

interface PresenceEntry {
  userId: Id;
  at: number;
}

/** Latest signal per person among the entries that are still fresh. */
export function activePresence(
  entries: PresenceEntry[],
  now: number,
  ttl = PRESENCE_TTL_MS,
): Record<Id, number> {
  const online: Record<Id, number> = {};
  for (const entry of entries)
    if (now - entry.at < ttl)
      online[entry.userId] = Math.max(online[entry.userId] ?? 0, entry.at);
  return online;
}

function readPresence(): Record<Id, number> {
  const entries: PresenceEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PRESENCE_PREFIX)) continue;
      const entry = JSON.parse(localStorage.getItem(key) ?? "null");
      if (entry?.userId && typeof entry.at === "number") entries.push(entry);
    }
  } catch {
    /* La presencia de la demo es opcional. */
  }
  return activePresence(entries, Date.now());
}

const presenceListeners = new Set<(online: Record<Id, number>) => void>();
let presenceKey: string | null = null;
let presenceTimer: ReturnType<typeof setInterval> | null = null;

function notifyPresence() {
  if (!presenceListeners.size) return;
  const online = readPresence();
  for (const listener of presenceListeners) listener(online);
}

function removePresenceKey() {
  if (!presenceKey) return;
  try {
    localStorage.removeItem(presenceKey);
  } catch {
    /* Sin almacenamiento. */
  }
  presenceKey = null;
}

function beat(userId: Id) {
  try {
    presenceKey ??= `${PRESENCE_PREFIX}${userId}.${crypto.randomUUID()}`;
    localStorage.setItem(
      presenceKey,
      JSON.stringify({ userId, at: Date.now() }),
    );
  } catch {
    /* La presencia de la demo es opcional. */
  }
  notifyPresence();
}

function stopPresence() {
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  removePresenceKey();
}

export const chatService: ChatService = {
  async listThreads() {
    const user = actor();
    return delay(
      readChatStore().threads.filter((thread) => canOpenThread(thread, user)),
    );
  },
  async loadOlder(threadId, beforeSentAt, limit = OLDER_PAGE) {
    const thread = requireThread(readChatStore(), actor(), threadId);
    const older = thread.messages.filter(
      (message) => message.sentAt < beforeSentAt,
    );
    return delay(limit > 0 ? older.slice(-limit) : []);
  },
  async directThread(otherId) {
    return delay(mutate((store, user) => directThread(store, user, otherId)));
  },
  async saveGroup(input) {
    return delay(mutate((store, user) => saveGroup(store, user, input)));
  },
  async deleteGroup(id) {
    mutate((store, user) => deleteGroup(store, user, id));
    return delay(undefined);
  },
  async sendMessage(threadId, input) {
    const message = mutate((store, user) => {
      sendMessage(store, user, threadId, input);
      return lastMessage(store, threadId);
    });
    return delay(message);
  },
  async editMessage(threadId, messageId, text) {
    mutate((store, user) =>
      changeMessage(store, user, threadId, messageId, text),
    );
    return delay(undefined);
  },
  async deleteMessage(threadId, messageId) {
    mutate((store, user) =>
      changeMessage(store, user, threadId, messageId, null),
    );
    return delay(undefined);
  },
  async reactToMessage(threadId, messageId, emoji) {
    mutate((store, user) =>
      reactToMessage(store, user, threadId, messageId, emoji),
    );
    return delay(undefined);
  },
  async forwardMessage(fromThreadId, messageId, toThreadId) {
    const message = mutate((store, user) => {
      forwardMessage(store, user, fromThreadId, messageId, toThreadId);
      return lastMessage(store, toThreadId);
    });
    return delay(message);
  },
  async markRead(threadId) {
    mutate(
      (store, user) => readThread(store, user, threadId),
      (changed) => changed,
    );
    return delay(undefined);
  },
  async getSettings() {
    return delay(chatSettingsFor(readChatStore(), actor().id));
  },
  async updateSettings(patch) {
    const settings = mutate((store, user) => {
      patchChatSettings(store, user.id, patch);
      return chatSettingsFor(store, user.id);
    });
    return delay(settings);
  },
  async listMemberStatus() {
    actor();
    const store = readChatStore();
    return delay(
      Object.fromEntries(
        getDb().profiles.map((profile) => {
          const { status, presence, currentProjectId } = chatSettingsFor(
            store,
            profile.id,
          );
          return [profile.id, { status, presence, currentProjectId }];
        }),
      ),
    );
  },
  async getWallpaperImage() {
    return delay(readWallpaperImage(actor().id));
  },
  async saveWallpaperImage(dataUrl) {
    if (!writeWallpaperImage(actor().id, dataUrl))
      throw new Error("La imagen es demasiado pesada para guardarla.");
    emit();
    return delay(undefined);
  },
  async removeWallpaperImage() {
    clearWallpaperImage(actor().id);
    emit();
    return delay(undefined);
  },
  async listSharedMessages(threadId) {
    const thread = requireThread(readChatStore(), actor(), threadId);
    const { media, documents, links } = collectSharedMedia(thread.messages);
    const ids = new Set(
      [...media, ...documents, ...links].map((item) => item.messageId),
    );
    return delay(thread.messages.filter((message) => ids.has(message.id)));
  },
  subscribe(listener: (event: ChatEvent) => void) {
    if (typeof window === "undefined") return () => undefined;
    const onChange = () => listener({});
    const onStorage = (event: Event) => {
      const key = (event as StorageEvent).key;
      if (key === null || key === CHAT_KEY || key.startsWith(WALLPAPER_PREFIX))
        onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHAT_UPDATE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHAT_UPDATE_EVENT, onChange);
    };
  },
  trackPresence(enabled) {
    stopPresence();
    if (enabled) {
      const id = getSessionUserId();
      if (id) {
        beat(id);
        presenceTimer = setInterval(() => beat(id), BEAT_MS);
        return;
      }
    }
    notifyPresence();
  },
  subscribePresence(callback) {
    presenceListeners.add(callback);
    callback(readPresence());
    return () => {
      presenceListeners.delete(callback);
    };
  },
};
