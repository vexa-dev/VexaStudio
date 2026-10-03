import { timerChime } from "../timer-audio";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { timerElapsed } from "@vexa/domain/timer";
import { useRunningEntry, usePauseTimer } from "../hooks/useTime";

const soundThresholds = new Map<string, number>();
const visibleThresholds = new Map<string, number>();

/** Frozen tabs cannot execute alarms; report one missed threshold on return. */
export function TimerAlerts() {
  const { user } = useAuth();
  const running = useRunningEntry();
  const query = useQueryClient();
  const { mutate: pauseTimer } = usePauseTimer();
  useEffect(() => {
    const refresh = () => {
      void query.invalidateQueries({ queryKey: ["time"] });
      void query.invalidateQueries({ queryKey: ["tasks"] });
      void query.invalidateQueries({ queryKey: ["projects"] });
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "vexa-studio.mock.db") refresh();
    };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [query]);
  useEffect(() => {
    const entry = running.data;
    if (!entry || entry.timerState === "paused" || !user) return;
    const check = () => {
      const hours = Math.floor(timerElapsed(entry) / 3600000);
      const key = `vexa.timer-alert.${user.id}.${entry.id}`;
      if (hours > (soundThresholds.get(key) ?? 0)) {
        soundThresholds.set(key, hours);
        timerChime();
      }
      if (document.visibilityState !== "visible") return;
      let last = visibleThresholds.get(key) ?? 0;
      try {
        last = Math.max(last, Number(localStorage.getItem(key) ?? 0));
      } catch {
        /* Private storage. */
      }
      if (hours > last) {
        visibleThresholds.set(key, hours);
        try {
          localStorage.setItem(key, String(hours));
        } catch {
          /* No persistence. */
        }
        toast.info(
          `Llevas ${hours} ${hours === 1 ? "hora" : "horas"} de trabajo`,
          {
            description:
              "¿Sigues trabajando? Puedes pausar o finalizar desde el reloj.",
            duration: 10000,
            action: { label: "Pausar reloj", onClick: () => pauseTimer() },
          },
        );
      }
    };
    check();
    const interval = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [running.data, user, pauseTimer]);
  return null;
}
