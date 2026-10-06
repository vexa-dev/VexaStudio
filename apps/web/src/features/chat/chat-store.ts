import type {
  ChatAttachment,
  ChatMessage,
  ChatSettings,
  ChatThread,
} from "@vexa/domain/chat";
import type { Profile } from "@vexa/domain/types";
import { normalizeWallpaper } from "./chat-wallpaper";

// Chat types live in the shared domain; re-exported so existing imports keep working.
export type { ChatAttachment, ChatMessage, ChatSettings, ChatThread };

export interface ChatStore {
  threads: ChatThread[];
  settings: Record<string, ChatSettings>;
}
export const CHAT_KEY = "vexa.chat-preview.v1";
export const defaultChatSettings: ChatSettings = {
  status: "Disponible",
  notifications: true,
  sound: "soft",
  presence: true,
  wallpaper: { kind: "none" },
  currentProjectId: null,
};
export function emptyChatStore(): ChatStore {
  return { threads: [], settings: {} };
}
export const CHAT_UPDATE_EVENT = "vexa-chat-update";
const STATUS_MAX_LENGTH = 80;
function normalizeProjectId(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}
/** Settings for one user; stored values from older versions are normalized. */
export function chatSettingsFor(
  store: ChatStore,
  userId: string,
): ChatSettings {
  const stored = store.settings[userId];
  if (!stored) return defaultChatSettings;
  return {
    ...defaultChatSettings,
    ...stored,
    wallpaper: normalizeWallpaper(stored.wallpaper),
    currentProjectId: normalizeProjectId(stored.currentProjectId),
  };
}
/** Merges a partial change over the user's settings, mutating the store. */
export function patchChatSettings(
  store: ChatStore,
  userId: string,
  patch: Partial<ChatSettings>,
) {
  const next = { ...chatSettingsFor(store, userId), ...patch };
  next.wallpaper = normalizeWallpaper(next.wallpaper);
  next.currentProjectId = normalizeProjectId(next.currentProjectId);
  next.status = next.status.slice(0, STATUS_MAX_LENGTH);
  store.settings[userId] = next;
}
/** Reads the persisted store; falls back to an empty one when unavailable. */
export function readChatStore(): ChatStore {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_KEY) ?? "null");
    if (
      stored &&
      Array.isArray(stored.threads) &&
      stored.settings &&
      typeof stored.settings === "object"
    )
      return stored;
  } catch {
    /* Sin almacenamiento disponible. */
  }
  return emptyChatStore();
}
/** Persists the store and notifies this tab (other tabs get `storage`). */
export function writeChatStore(store: ChatStore) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHAT_UPDATE_EVENT));
}
export function canOpenThread(thread: ChatThread, user: Profile) {
  return (
    thread.members.includes(user.id) ||
    (thread.kind === "group" && user.role === "admin")
  );
}
export function requireThread(
  store: ChatStore,
  user: Profile,
  id: string,
): ChatThread {
  const thread = store.threads.find((entry) => entry.id === id);
  if (!thread || !canOpenThread(thread, user))
    throw new Error("No tienes acceso a esta conversación.");
  return thread;
}
function admin(user: Profile) {
  if (user.role !== "admin")
    throw new Error("Solo los administradores pueden gestionar grupos.");
}
export function directThread(store: ChatStore, user: Profile, otherId: string) {
  if (!otherId || otherId === user.id)
    throw new Error("Selecciona a otra persona.");
  let thread = store.threads.find(
    (entry) =>
      entry.kind === "direct" &&
      entry.members.includes(user.id) &&
      entry.members.includes(otherId),
  );
  if (!thread) {
    thread = {
      id: crypto.randomUUID(),
      kind: "direct",
      name: "",
      description: "",
      members: [user.id, otherId],
      messages: [],
      readAt: {},
    };
    store.threads.unshift(thread);
  }
  return thread.id;
}
export function saveGroup(
  store: ChatStore,
  user: Profile,
  input: { id?: string; name: string; description: string; members: string[] },
) {
  admin(user);
  if (!input.name.trim()) throw new Error("Escribe el nombre del grupo.");
  if (!input.members.length)
    throw new Error("Selecciona al menos un integrante.");
  const members = [...new Set([user.id, ...input.members])];
  if (input.id) {
    const thread = requireThread(store, user, input.id);
    if (thread.kind !== "group")
      throw new Error("Esta conversación no es un grupo.");
    thread.name = input.name.trim();
    thread.description = input.description.trim();
    thread.members = members;
    return thread.id;
  }
  const id = crypto.randomUUID();
  store.threads.unshift({
    id,
    kind: "group",
    name: input.name.trim(),
    description: input.description.trim(),
    members,
    messages: [],
    readAt: {},
  });
  return id;
}
export function deleteGroup(store: ChatStore, user: Profile, id: string) {
  admin(user);
  const thread = requireThread(store, user, id);
  if (thread.kind !== "group")
    throw new Error("Solo se pueden eliminar grupos.");
  store.threads = store.threads.filter((entry) => entry.id !== id);
}
export function sendMessage(
  store: ChatStore,
  user: Profile,
  threadId: string,
  input: { text: string; attachment?: ChatAttachment; replyTo?: string },
) {
  const thread = requireThread(store, user, threadId);
  if (!input.text.trim() && !input.attachment)
    throw new Error("Escribe un mensaje o adjunta un archivo.");
  if (input.text.length > 4000)
    throw new Error("El mensaje puede tener hasta 4000 caracteres.");
  if (
    input.replyTo &&
    !thread.messages.some((entry) => entry.id === input.replyTo)
  )
    throw new Error("El mensaje original ya no está disponible.");
  thread.messages.push({
    id: crypto.randomUUID(),
    authorId: user.id,
    text: input.text.trim(),
    attachment: input.attachment,
    replyTo: input.replyTo,
    sentAt: Date.now(),
    reactions: {},
  });
  thread.readAt[user.id] = Date.now();
}
export function changeMessage(
  store: ChatStore,
  user: Profile,
  threadId: string,
  messageId: string,
  text: string | null,
) {
  const thread = requireThread(store, user, threadId);
  const message = thread.messages.find((entry) => entry.id === messageId);
  if (!message || message.deleted)
    throw new Error("El mensaje ya no está disponible.");
  if (
    message.authorId !== user.id &&
    !(text === null && thread.kind === "group" && user.role === "admin")
  )
    throw new Error("Solo puedes editar o eliminar tus mensajes.");
  if (text === null) {
    message.deleted = true;
    message.text = "";
    delete message.attachment;
    message.reactions = {};
  } else {
    if (!text.trim() || text.length > 4000)
      throw new Error("Escribe un mensaje de hasta 4000 caracteres.");
    message.text = text.trim();
    message.editedAt = Date.now();
  }
}
export function reactToMessage(
  store: ChatStore,
  user: Profile,
  threadId: string,
  messageId: string,
  emoji: string,
) {
  const message = requireThread(store, user, threadId).messages.find(
    (entry) => entry.id === messageId,
  );
  if (!message || message.deleted)
    throw new Error("El mensaje ya no está disponible.");
  if (message.reactions[user.id] === emoji) delete message.reactions[user.id];
  else message.reactions[user.id] = emoji;
}
/** Marks the thread read up to now; returns false when it was already up to date. */
export function readThread(
  store: ChatStore,
  user: Profile,
  threadId: string,
): boolean {
  const thread = requireThread(store, user, threadId);
  const last = thread.messages.at(-1)?.sentAt;
  if (!last || (thread.readAt[user.id] ?? 0) >= last) return false;
  thread.readAt[user.id] = Date.now();
  return true;
}
/** Copies a message into another thread: "Reenviado: " text, same attachment, no reply. */
export function forwardMessage(
  store: ChatStore,
  user: Profile,
  fromThreadId: string,
  messageId: string,
  toThreadId: string,
) {
  const message = requireThread(store, user, fromThreadId).messages.find(
    (entry) => entry.id === messageId,
  );
  if (!message || message.deleted)
    throw new Error("El mensaje ya no está disponible.");
  sendMessage(store, user, toThreadId, {
    text: message.text ? `Reenviado: ${message.text}` : "",
    attachment: message.attachment ? { ...message.attachment } : undefined,
  });
}
