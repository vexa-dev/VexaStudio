import { creditShare, entriesCreditedTo } from "@vexa/domain/hours-credit";
import type { Id, TimeEntry } from "@vexa/domain/types";
import { monthlyActivity } from "@vexa/domain/time-activity";

export { monthlyActivity };

/** Monthly activity as a person sees it: their own entries plus the validated ones they were tagged in, at their share. */
export function creditedActivity(
  entries: TimeEntry[],
  userId: Id,
  month: string,
) {
  return monthlyActivity(entriesCreditedTo(entries, userId), month);
}

/** Hours of an entry that count for a person (owner 100 %, tagged their share, anyone else 0). */
export function creditedHours(entry: TimeEntry, userId: Id): number {
  return (entry.hours * creditShare(entry, userId)) / 100;
}

/** The person was tagged on an entry owned by someone else. */
export function isTaggedIn(entry: TimeEntry, userId: Id): boolean {
  return (
    entry.userId !== userId &&
    Boolean(entry.participants?.some((p) => p.userId === userId))
  );
}

/** Own entries plus the (not voided) ones where the person was tagged. */
export function entriesVisibleTo(entries: TimeEntry[], userId: Id): TimeEntry[] {
  return entries.filter(
    (e) => e.userId === userId || (isTaggedIn(e, userId) && !e.voidedAt),
  );
}
