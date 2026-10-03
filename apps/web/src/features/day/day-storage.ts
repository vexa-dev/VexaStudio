export type DayPriority = {
  id: string;
  title: string;
  taskId: string | null;
  projectId: string | null;
  done: boolean;
};
export type DailyDraft = {
  done: string;
  next: string;
  blockers: string;
  needsFrom?: string;
};
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function dailyDates(userId: string, today: string) {
  const prefix = `vexa.daily-draft.${userId}.`;
  const dates = new Set([today]);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key?.startsWith(prefix) &&
        /^\d{4}-\d{2}-\d{2}$/.test(key.slice(prefix.length))
      )
        dates.add(key.slice(prefix.length));
    }
  } catch {
    /* Current day remains available. */
  }
  return [...dates].sort().reverse();
}
