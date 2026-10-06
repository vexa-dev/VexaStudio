import { monthKey, formatMonthLabel } from "@vexa/domain/dates";
import {
  dataUrlBytes,
  kindOfFile,
  type AttachmentKindId,
} from "./attachment-kinds";
import type { ChatMessage } from "./chat-store";

/*
 * Known limit: in this stage attachments are base64 strings in the browser's
 * localStorage, so the history only shows what was sent from this browser.
 * With Supabase Storage the list will come from the server.
 */

export interface SharedFile {
  messageId: string;
  authorId: string;
  sentAt: number;
  name: string;
  mime: string;
  kind: AttachmentKindId;
  bytes: number;
  data: string;
}

export interface SharedLink {
  messageId: string;
  authorId: string;
  sentAt: number;
  url: string;
  host: string;
}

export interface SharedMedia {
  media: SharedFile[];
  documents: SharedFile[];
  links: SharedLink[];
}

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

function linksOf(message: ChatMessage): SharedLink[] {
  const seen = new Set<string>();
  const links: SharedLink[] = [];
  for (const match of message.text.match(URL_PATTERN) ?? []) {
    const url = match.replace(TRAILING_PUNCTUATION, "");
    if (seen.has(url)) continue;
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (!host) continue;
    seen.add(url);
    links.push({
      messageId: message.id,
      authorId: message.authorId,
      sentAt: message.sentAt,
      url,
      host,
    });
  }
  return links;
}

const newestFirst = (a: { sentAt: number }, b: { sentAt: number }) =>
  b.sentAt - a.sentAt;

/** Splits a conversation's messages into media, documents and links, newest first. */
export function collectSharedMedia(messages: ChatMessage[]): SharedMedia {
  const media: SharedFile[] = [];
  const documents: SharedFile[] = [];
  const links: SharedLink[] = [];
  for (const message of messages) {
    if (message.deleted) continue;
    const { attachment } = message;
    if (attachment) {
      const kind = kindOfFile(attachment).id;
      const file: SharedFile = {
        messageId: message.id,
        authorId: message.authorId,
        sentAt: message.sentAt,
        name: attachment.name,
        mime: attachment.type,
        kind,
        bytes: dataUrlBytes(attachment.data),
        data: attachment.data,
      };
      (kind === "image" || kind === "video" ? media : documents).push(file);
    }
    links.push(...linksOf(message));
  }
  return {
    media: media.sort(newestFirst),
    documents: documents.sort(newestFirst),
    links: links.sort(newestFirst),
  };
}

export interface MonthGroup<T> {
  /** `YYYY-MM` in Lima time. */
  key: string;
  label: string;
  items: T[];
}

/** Groups items by Lima calendar month, newest month first, keeping item order. */
export function groupByMonth<T extends { sentAt: number }>(
  items: T[],
): MonthGroup<T>[] {
  const groups = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const key = monthKey(new Date(item.sentAt));
    let group = groups.get(key);
    if (!group) {
      group = { key, label: formatMonthLabel(key), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}
