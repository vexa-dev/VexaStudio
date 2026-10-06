import type { ChatMessage, ChatSettings, ChatThread } from "@vexa/domain/chat";

/** Characters of a message shown in the "new message" toast. */
export const NOTICE_BODY_LENGTH = 100;

function unreadIn(thread: ChatThread, userId: string): number {
  const readAt = thread.readAt[userId] ?? 0;
  return thread.messages.filter(
    (message) => message.authorId !== userId && message.sentAt > readAt,
  ).length;
}

/** Unread messages per thread: others' messages newer than my read time. */
export function unreadByThread(
  threads: ChatThread[],
  userId: string,
): Record<string, number> {
  return Object.fromEntries(
    threads.map((thread) => [thread.id, unreadIn(thread, userId)]),
  );
}

/** The one place that totals unread messages (badge and list summary). */
export function countUnread(threads: ChatThread[], userId: string): number {
  return threads.reduce((sum, thread) => sum + unreadIn(thread, userId), 0);
}

/** Messages from other people that were not in the previous snapshot. */
export function incomingMessages(
  previousIds: ReadonlySet<string>,
  threads: ChatThread[],
  userId: string,
): ChatMessage[] {
  return threads
    .flatMap((thread) => thread.messages)
    .filter(
      (message) => !previousIds.has(message.id) && message.authorId !== userId,
    );
}

/** Text of the incoming-message toast. */
export function noticeBody(message: ChatMessage): string {
  return message.text.slice(0, NOTICE_BODY_LENGTH) || "Archivo adjunto";
}

/** Read when another member's read time is at or after the send time. */
export function isReadByOthers(
  thread: ChatThread,
  message: ChatMessage,
  userId: string,
): boolean {
  return thread.members.some(
    (id) => id !== userId && (thread.readAt[id] ?? 0) >= message.sentAt,
  );
}

/** One emoji per user: the same one toggles off, a different one replaces. */
export function applyReaction(
  reactions: Record<string, string>,
  userId: string,
  emoji: string,
): Record<string, string> {
  const next = { ...reactions };
  if (next[userId] === emoji) delete next[userId];
  else next[userId] = emoji;
  return next;
}

/**
 * One toast (and one sound) per batch of new messages from others, only with
 * notices on: the body is the latest message; `sound` is null when muted.
 */
export function incomingNotice(
  incoming: ChatMessage[],
  settings: Pick<ChatSettings, "notifications" | "sound">,
): { body: string; sound: "soft" | "bell" | null } | null {
  const latest = incoming.at(-1);
  if (!latest || !settings.notifications) return null;
  return {
    body: noticeBody(latest),
    sound: settings.sound === "none" ? null : settings.sound,
  };
}
