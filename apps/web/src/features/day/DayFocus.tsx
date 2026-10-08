import { useEffect, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/features/time/components/TimePickers";
import {
  readFocusSession,
  writeFocusSession,
  type FocusSession,
} from "./focus-session";
export function DayFocus({ userId }: { userId: string }) {
  const [session, setSession] = useState<FocusSession>(() =>
    readFocusSession(userId),
  );
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState("");
  const seconds = session.deadline
    ? Math.max(0, Math.ceil((session.deadline - now) / 1000))
    : session.remaining;
  const running = session.deadline !== null;
  function store(next: FocusSession) {
    setSession(next);
    setNotice(
      writeFocusSession(userId, next)
        ? ""
        : "La sesión se conservará solo mientras sigas en esta pantalla.",
    );
  }
  useEffect(() => {
    if (!session.deadline) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= session.deadline!) {
        const next = {
          ...session,
          remaining: 0,
          deadline: null,
          completed: true,
        };
        setSession(next);
        writeFocusSession(userId, next);
      }
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [session, userId]);
  function reset(mode = session.mode, minutes = mode === "focus" ? 25 : 5) {
    store({
      mode,
      minutes,
      remaining: minutes * 60,
      deadline: null,
      completed: false,
    });
  }
  function toggle() {
    const time = seconds || session.minutes * 60;
    setNow(Date.now());
    store({
      ...session,
      remaining: time,
      deadline: running ? null : Date.now() + time * 1000,
      completed: false,
    });
  }
  return (
    <Card className="day-focus-card" data-mode={session.mode}>
      <div className="day-card-title">
        <h2>
          <Target size={18} /> Pomodoro
        </h2>
        <ChoicePicker
          label="Duración"
          hideLabel
          value={String(session.minutes)}
          options={(session.mode === "focus" ? [15, 25, 50] : [5, 10]).map(
            (n) => ({ value: String(n), label: String(n) + " min" }),
          )}
          onChange={(value) => reset(session.mode, Number(value))}
        />
      </div>
      <div className="day-focus-body">
        <div className="day-focus-dial">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="day-dial-ticks" cx="60" cy="60" r="55" />
            <circle className="day-dial-track" cx="60" cy="60" r="47" />
            <circle
              className="day-dial-remaining"
              cx="60"
              cy="60"
              r="47"
              strokeDasharray="295.31"
              strokeDashoffset={295.31 * (1 - seconds / (session.minutes * 60))}
            />
          </svg>
          <div className="day-focus-display">
            <span
              role="timer"
              aria-label={
                session.mode === "focus"
                  ? "Tiempo de concentración"
                  : "Tiempo de descanso"
              }
            >
              {String(Math.floor(seconds / 60)).padStart(2, "0")}
              <span>:</span>
              {String(seconds % 60).padStart(2, "0")}
            </span>
            <p>
              {session.completed
                ? "Completado"
                : running
                  ? "En curso"
                  : seconds === session.minutes * 60
                    ? "Listo para empezar"
                    : "En pausa"}
            </p>
          </div>
        </div>
        <div className="day-focus-modes">
          <button
            aria-pressed={session.mode === "focus"}
            onClick={() => reset("focus")}
          >
            <Target size={15} />
            <span>
              Concentración<small>Una cosa a la vez</small>
            </span>
          </button>
          <button
            aria-pressed={session.mode === "break"}
            onClick={() => reset("break")}
          >
            <Coffee size={15} />
            <span>
              Descanso<small>Recarga tu energía</small>
            </span>
          </button>
        </div>
      </div>
      <progress
        className="sr-only"
        aria-label="Avance de concentración"
        max={session.minutes * 60}
        value={session.minutes * 60 - seconds}
      />
      <div className="day-focus-actions">
        <Button
          onClick={
            session.completed
              ? () => reset(session.mode === "focus" ? "break" : "focus")
              : toggle
          }
        >
          {running ? <Pause size={15} /> : <Play size={15} />}{" "}
          {session.completed
            ? session.mode === "focus"
              ? "Tomar descanso"
              : "Volver al foco"
            : running
              ? "Pausar"
              : seconds === session.minutes * 60 || session.completed
                ? session.mode === "focus"
                  ? "Comenzar foco"
                  : "Comenzar descanso"
                : "Continuar"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => reset(session.mode, session.minutes)}
          aria-label="Reiniciar concentración"
        >
          <RotateCcw size={15} />
        </Button>
      </div>
      <p className="day-note day-focus-footer">
        Se conserva al navegar. No suma horas de trabajo.
      </p>
      {notice && (
        <output aria-live="polite" className="day-note">
          {notice}
        </output>
      )}
    </Card>
  );
}
