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

/** Title of the incoming-message toast: who wrote, plus the group name in groups. */
export function noticeTitle(
  authorName: string | undefined,
  thread: ChatThread | undefined,
): string {
  const author = authorName || "Integrante";
  return thread?.kind === "group" && thread.name
    ? `${author} · ${thread.name}`
    : author;
}

/**
 * Threads by latest message, newest first (like a messaging app). Threads without
 * messages go last in their original order; equal timestamps break by id.
 * Returns a new array.
 */
export function sortThreadsByActivity(threads: ChatThread[]): ChatThread[] {
  const latest = (thread: ChatThread) =>
    thread.messages.reduce((max, message) => Math.max(max, message.sentAt), 0);
  return threads
    .map((thread) => ({ thread, at: thread.messages.length ? latest(thread) : null }))
    .sort((a, b) => {
      if (a.at === null || b.at === null)
        return a.at === b.at ? 0 : a.at === null ? 1 : -1;
      if (a.at !== b.at) return b.at - a.at;
      return a.thread.id < b.thread.id ? -1 : a.thread.id > b.thread.id ? 1 : 0;
    })
    .map(({ thread }) => thread);
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

/** Tick state of my own message: one check, two checks, two green checks. */
export type MessageStatus = "sent" | "delivered" | "read";

/**
 * Read = another member's read time is at or after the send time; delivered =
 * the same with their delivery time. Read implies delivered; in a group one
 * member is enough.
 */
export function messageStatus(
  thread: ChatThread,
  message: ChatMessage,
  userId: string,
): MessageStatus {
  if (isReadByOthers(thread, message, userId)) return "read";
  const delivered = thread.members.some(
    (id) => id !== userId && (thread.deliveredAt?.[id] ?? 0) >= message.sentAt,
  );
  return delivered ? "delivered" : "sent";
}

/**
 * Send time of the newest message from others that I have neither received
 * nor read yet, or null when delivery is up to date.
 */
export function needsDelivery(
  thread: ChatThread,
  userId: string,
): number | null {
  const seen = Math.max(
    thread.deliveredAt?.[userId] ?? 0,
    thread.readAt[userId] ?? 0,
  );
  const latest = thread.messages
    .filter((message) => message.authorId !== userId)
    .reduce((max, message) => Math.max(max, message.sentAt), 0);
  return latest > seen ? latest : null;
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

/**
 * Where an attachment is in its keep-or-release cycle:
 * - `none`: no cycle (no file, annulled message, or a thread with one member).
 * - `downloading`: some member has not downloaded it yet.
 * - `asking`: everybody downloaded; at least one member has not answered.
 * - `kept`: someone answered "keep": the file stays for good.
 * - `ready`: every member answered "release": the file can be removed.
 * - `purged`: the file was removed; only the placeholder remains.
 */
export type AttachmentStage =
  "none" | "downloading" | "asking" | "kept" | "ready" | "purged";

/** Members who still have to download the file (the sender counts as downloaded). */
export function pendingDownloads(
  thread: ChatThread,
  message: ChatMessage,
): string[] {
  return thread.members.filter(
    (id) =>
      id !== message.authorId &&
      !(id in (message.attachmentLife?.downloadedAt ?? {})),
  );
}

export function attachmentStage(
  thread: ChatThread,
  message: ChatMessage,
): AttachmentStage {
  if (message.deleted) return "none";
  if (message.purgedAttachment) return "purged";
  if (!message.attachment || thread.members.length < 2) return "none";
  if (pendingDownloads(thread, message).length) return "downloading";
  const keep = message.attachmentLife?.keep ?? {};
  if (Object.values(keep).some((value) => value)) return "kept";
  // Unanswered counts as keep: only a full set of "release" answers removes the file.
  return thread.members.every((id) => keep[id] === false) ? "ready" : "asking";
}

/** True when I am a member who has not answered and the question is still open. */
export function needsMyAnswer(
  thread: ChatThread,
  message: ChatMessage,
  userId: string,
): boolean {
  return (
    thread.members.includes(userId) &&
    attachmentStage(thread, message) === "asking" &&
    message.attachmentLife?.keep[userId] === undefined
  );
}

/** True when my opening of the file still has to be reported as a download. */
export function shouldMarkDownload(
  thread: ChatThread,
  message: ChatMessage,
  userId: string,
): boolean {
  const stage = attachmentStage(thread, message);
  return (
    thread.members.includes(userId) &&
    userId !== message.authorId &&
    stage !== "none" &&
    stage !== "purged" &&
    !(userId in (message.attachmentLife?.downloadedAt ?? {}))
  );
}
