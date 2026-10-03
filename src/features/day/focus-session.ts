import { readLocal, writeLocal } from "./day-storage";

export type FocusSession = {
  mode: "focus" | "break";
  minutes: number;
  remaining: number;
  deadline: number | null;
  completed: boolean;
};
export const focusSessionEvent = "vexa:focus-session";
export const focusSessionKey = (userId: string) => `vexa.focus.${userId}`;

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
export function readFocusSession(userId: string): FocusSession {
  const saved = readLocal<unknown>(focusSessionKey(userId), null);
  return isFocusSession(saved)
    ? saved
    : {
        mode: "focus",
        minutes: 25,
        remaining: 1500,
        deadline: null,
        completed: false,
      };
}
export function writeFocusSession(userId: string, session: FocusSession) {
  const saved = writeLocal(focusSessionKey(userId), session);
  window.dispatchEvent(
    new CustomEvent(focusSessionEvent, { detail: { userId, session } }),
  );
  return saved;
}
export function isResting(session: FocusSession, now = Date.now()) {
  return (
    session.mode === "break" &&
    !session.completed &&
    session.remaining > 0 &&
    (session.deadline === null || session.deadline > now)
  );
}
