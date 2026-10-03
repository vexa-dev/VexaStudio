import { useEffect, useState } from "react";
import type { TimeEntry } from "@/domain/types";
import { timerElapsed } from "@/domain/timer";
export function useElapsed(
  input: string | TimeEntry | null | undefined,
): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return typeof input === "string"
    ? Math.max(0, now - Date.parse(input))
    : timerElapsed(input, now);
}
