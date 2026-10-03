export type FocusSession = {
  mode: "focus" | "break";
  minutes: number;
  remaining: number;
  deadline: number | null;
  completed: boolean;
};
export function isFocusSession(value: unknown): value is FocusSession {
  if (!value || typeof value !== "object") return false;
  const session = value as FocusSession;
  return (
    (session.mode === "focus" || session.mode === "break") &&
    (session.mode === "focus" ? [15, 25, 50] : [5, 10]).includes(
      session.minutes,
    ) &&
    Number.isFinite(session.remaining) &&
    session.remaining >= 0 &&
    session.remaining <= session.minutes * 60 &&
    (session.deadline === null || Number.isFinite(session.deadline)) &&
    typeof session.completed === "boolean"
  );
}
export function isResting(session: FocusSession, now = Date.now()) {
  return (
    session.mode === "break" &&
    !session.completed &&
    session.remaining > 0 &&
    (session.deadline === null || session.deadline > now)
  );
}
