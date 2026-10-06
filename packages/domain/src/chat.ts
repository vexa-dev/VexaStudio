import type { Id } from "./types";

/*
 * Chat domain types, shared by the web app and every service implementation.
 * Timestamps are epoch milliseconds (`number`), as the chat has always stored
 * them. Adapters that talk to a database convert from/to ISO strings at their
 * boundary; nothing above the service layer ever sees an ISO chat date.
 */

/** File sent in a message. `data` is a data URL (mock) or a signed URL. */
export interface ChatAttachment {
  name: string;
  type: string;
  data: string;
}

export interface ChatMessage {
  id: Id;
  authorId: Id;
  /** Trimmed text; empty for attachment-only and deleted messages. */
  text: string;
  sentAt: number;
  editedAt?: number;
  /** Soft delete: text is "", no attachment, no reactions. */
  deleted?: boolean;
  replyTo?: Id;
  attachment?: ChatAttachment;
  /** One emoji per user: `userId -> emoji`. */
  reactions: Record<Id, string>;
}

export interface ChatThread {
  id: Id;
  kind: "direct" | "group";
  /** Empty for direct threads (the title is the other person). */
  name: string;
  description: string;
  members: Id[];
  messages: ChatMessage[];
  /** Last read time per member (and per admin who read a group): `userId -> ms`. */
  readAt: Record<Id, number>;
  archived?: boolean;
}

/** Wallpaper bytes live apart from this value; `image` points at them. */
export type ChatWallpaper =
  { kind: "none" } | { kind: "preset"; id: string } | { kind: "image" };

export interface ChatSettings {
  status: string;
  notifications: boolean;
  sound: "soft" | "bell" | "none";
  presence: boolean;
  wallpaper: ChatWallpaper;
  /** Project pinned by hand; shown when no timer is running. */
  currentProjectId: Id | null;
}

/** What everybody in the studio may see about one person. */
export interface ChatMemberStatus {
  status: string;
  presence: boolean;
  currentProjectId: Id | null;
}

/** Invalidation hint: something changed (in one thread, if `threadId` is set). */
export interface ChatEvent {
  threadId?: Id;
}
