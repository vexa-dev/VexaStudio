/** Badge text for the unread chat counter: empty when nothing to show, capped at "9+". */
export function unreadLabel(count: number): string {
  if (!Number.isFinite(count) || count < 1) return "";
  return count > 9 ? "9+" : String(Math.floor(count));
}
