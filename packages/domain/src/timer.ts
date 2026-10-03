import type { TimeEntry } from "./types";

/** The clock is derived from persisted dates. A suspended browser never loses ticks. */
export function timerElapsed(
  entry: TimeEntry | null | undefined,
  now = Date.now(),
): number {
  if (!entry) return 0;
  if (entry.endedAt) return entry.elapsedMs ?? entry.hours * 3600000;
  const saved = entry.elapsedMs ?? 0;
  if (entry.timerState === "paused") return saved;
  return (
    saved +
    Math.max(0, now - Date.parse(entry.segmentStartedAt ?? entry.startedAt))
  );
}
