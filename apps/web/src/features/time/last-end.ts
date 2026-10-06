import type { IsoDate, TimeEntry } from "@vexa/domain/types";
import type { ClockTime } from "@vexa/domain/clock";
import { todayLima } from "@vexa/domain/dates";

const LIMA_OFFSET_MS = 5 * 3600000;

/**
 * Lima wall-clock end of the user's latest finished entry on `date`.
 * Voided entries, drafts and open timers do not count.
 */
export function lastEndOnDate(
  entries: readonly TimeEntry[],
  date: IsoDate,
  userId: string,
): ClockTime | null {
  let latest: number | null = null;
  for (const entry of entries) {
    if (entry.userId !== userId || entry.voidedAt || entry.draft) continue;
    if (!entry.endedAt) continue;
    const end = new Date(entry.endedAt);
    if (Number.isNaN(end.getTime()) || todayLima(end) !== date) continue;
    if (latest === null || end.getTime() > latest) latest = end.getTime();
  }
  if (latest === null) return null;
  const lima = new Date(latest - LIMA_OFFSET_MS);
  return { hour24: lima.getUTCHours(), minute: lima.getUTCMinutes() };
}
