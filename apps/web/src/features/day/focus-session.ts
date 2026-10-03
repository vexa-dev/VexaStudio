import { readLocal, writeLocal } from "./day-storage";

import { isFocusSession, type FocusSession } from "@vexa/domain/focus";
export { isResting, isFocusSession, type FocusSession } from "@vexa/domain/focus";

export const focusSessionEvent = "vexa:focus-session";
export const focusSessionKey = (userId: string) => `vexa.focus.${userId}`;

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
