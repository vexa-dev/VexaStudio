import { formatDate, formatDateTime, todayLima } from "@vexa/domain/dates";
import type { ChatMessage } from "./chat-store";

const DAY_MS = 24 * 60 * 60 * 1000;
export const RUN_WINDOW_MS = 5 * 60 * 1000;

/** Lima calendar day (`YYYY-MM-DD`) of an instant. */
export function limaDayKey(at: number): string {
  return todayLima(new Date(at));
}

type DayRelation = "today" | "yesterday" | "older";

function relation(sentAt: number, now: number | Date): DayRelation {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const day = limaDayKey(sentAt);
  if (day === limaDayKey(nowMs)) return "today";
  // Lima has no daylight saving, so a fixed 24 h step lands on the previous day.
  if (day === limaDayKey(nowMs - DAY_MS)) return "yesterday";
  return "older";
}

/** Day separator label in Lima time: `Hoy`, `Ayer` or `dd/mm/yyyy`. */
export function dayLabel(sentAt: number, now: number | Date = Date.now()) {
  const kind = relation(sentAt, now);
  if (kind === "today") return "Hoy";
  if (kind === "yesterday") return "Ayer";
  return formatDate(new Date(sentAt));
}

/** Thread-list time: `HH:mm` today, `Ayer`, or `dd/mm`, in Lima time. */
export function shortTime(sentAt: number, now: number | Date = Date.now()) {
  const kind = relation(sentAt, now);
  const stamp = formatDateTime(new Date(sentAt)); // dd/MM/yyyy HH:mm
  if (kind === "today") return stamp.slice(11, 16);
  if (kind === "yesterday") return "Ayer";
  return stamp.slice(0, 5);
}

export type MessageItem =
  | { kind: "day"; key: string; sentAt: number }
  | { kind: "run"; key: string; authorId: string; messages: ChatMessage[] };

/**
 * Splits messages into day separators and runs of same-author messages. A run
 * breaks on author change, on Lima day change, or when the gap to the previous
 * message exceeds `windowMs`. Deleted messages stay in their run.
 */
export function groupMessages(
  messages: ChatMessage[],
  windowMs: number = RUN_WINDOW_MS,
): MessageItem[] {
  const items: MessageItem[] = [];
  let day = "";
  let run: Extract<MessageItem, { kind: "run" }> | undefined;
  for (const message of messages) {
    const key = limaDayKey(message.sentAt);
    if (key !== day) {
      day = key;
      run = undefined;
      items.push({ kind: "day", key: `day-${key}`, sentAt: message.sentAt });
    }
    const previous = run?.messages.at(-1);
    if (
      run &&
      previous &&
      run.authorId === message.authorId &&
      message.sentAt - previous.sentAt <= windowMs
    ) {
      run.messages.push(message);
    } else {
      run = {
        kind: "run",
        key: `run-${message.id}`,
        authorId: message.authorId,
        messages: [message],
      };
      items.push(run);
    }
  }
  return items;
}
