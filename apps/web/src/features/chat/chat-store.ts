import type { Profile } from "@vexa/domain/types";

export interface ChatAttachment {
  name: string;
  type: string;
  data: string;
}
export interface ChatMessage {
  id: string;
  authorId: string;
  text: string;
  sentAt: number;
  editedAt?: number;
  deleted?: boolean;
  replyTo?: string;
  attachment?: ChatAttachment;
  reactions: Record<string, string>;
}
export interface ChatThread {
  id: string;
  kind: "direct" | "group";
  name: string;
  description: string;
  members: string[];
  messages: ChatMessage[];
  readAt: Record<string, number>;
  archived?: boolean;
}
export interface ChatSettings {
  status: string;
  notifications: boolean;
  sound: "soft" | "bell" | "none";
  presence: boolean;
}
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
};
export function emptyChatStore(): ChatStore {
  return { threads: [], settings: {} };
}
export function canOpenThread(thread: ChatThread, user: Profile) {
  return (
    thread.members.includes(user.id) ||
    (thread.kind === "group" && user.role === "admin")
  );
}
function requireThread(
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
