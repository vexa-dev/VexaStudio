import { useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play, Square, Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatClock } from "@/lib/format";
import { useElapsed } from "@/features/time/hooks/useElapsed";
import {
  useRunningEntry,
  usePauseTimer,
  useResumeTimer,
  useStopTimer,
} from "@/features/time/hooks/useTime";
import {
  enableTimerSound,
  timerSoundEnabled,
} from "@/features/time/timer-audio";

export function TaskTimer() {
  const running = useRunningEntry();
  const entry = running.data;
  const elapsed = useElapsed(entry);
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  const stop = useStopTimer();
  const [sound, setSound] = useState(timerSoundEnabled);
  if (!entry)
    return (
      <p className="mb-5 text-sm text-muted">
        Inicia el reloj desde una de tus tareas. Puedes cerrar la página: el
        tiempo se recupera al volver.
      </p>
    );
  const paused = entry.timerState === "paused";
  return (
    <Card
      tone="accent"
      className="mb-5 flex flex-wrap items-center justify-between gap-4"
    >
      <div className="min-w-0">
        <p className="text-xs text-muted">
          {paused ? "En pausa · tiempo conservado" : "Trabajando · continúa fuera de la página"}
        </p>
        <h2 className="mt-1 font-semibold">{entry.description}</h2>
        <p
          role="timer"
          aria-label="Tiempo de trabajo"
          className="num mt-2 text-3xl font-semibold"
        >
          {formatClock(elapsed)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pause.isPending || resume.isPending}
          onClick={() => (paused ? resume.mutate() : pause.mutate())}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
          {paused ? "Continuar" : "Pausar"}
        </Button>
        <Button disabled={stop.isPending} onClick={() => stop.mutate()}>
          <Square size={15} /> Finalizar
        </Button>
        <Button
          variant="ghost"
          aria-pressed={sound}
          onClick={() => {
            const enabled = !sound;
            setSound(enabled);
            enableTimerSound(enabled);
          }}
        >
          <Bell size={16} />
          {sound ? "Sonido activado" : "Sonido cada hora"}
        </Button>
        <Link
          className="inline-flex min-h-11 items-center px-2 text-sm text-primary-text"
          to="/horas"
        >
          Revisar horas ↗
        </Link>
      </div>
    </Card>
  );
}
