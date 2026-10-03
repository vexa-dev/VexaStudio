import { useEffect, useState } from "react";
import {
  focusSessionEvent,
  focusSessionKey,
  isResting,
  readFocusSession,
  type FocusSession,
} from "./focus-session";

/** Shares the personal break with the mascot, including when Mi día is unmounted. */
export function useFocusRest(userId: string | undefined) {
  const [resting, setResting] = useState(() =>
    userId ? isResting(readFocusSession(userId)) : false,
  );
  useEffect(() => {
    if (!userId) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function update(session = readFocusSession(userId!)) {
      clearTimeout(timeout);
      setResting(isResting(session));
      if (isResting(session) && session.deadline !== null)
        timeout = setTimeout(
          () => setResting(false),
          Math.max(0, session.deadline - Date.now()),
        );
    }
    function changed(event: Event) {
      const detail = (
        event as CustomEvent<{ userId: string; session: FocusSession }>
      ).detail;
      if (detail.userId === userId) update(detail.session);
    }
    function storage(event: StorageEvent) {
      if (event.key === null || event.key === focusSessionKey(userId!))
        update();
    }
    const refresh = () => update();
    update();
    window.addEventListener(focusSessionEvent, changed);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener(focusSessionEvent, changed);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);
  return Boolean(userId) && resting;
}
