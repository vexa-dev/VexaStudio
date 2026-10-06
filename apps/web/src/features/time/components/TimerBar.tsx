import { Square, Clock3, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import "./timer.css";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { formatClock } from "@vexa/domain/format";
import { useElapsed } from "../hooks/useElapsed";
import {
  useRunningEntry,
  useStopTimer,
  usePauseTimer,
  useResumeTimer,
} from "../hooks/useTime";

/** Datos del temporizador abierto, listos para mostrar en la barra (móvil) o el chip (escritorio). */
function useRunningTimer() {
  const running = useRunningEntry();
  const tasks = useTasks();
  const entry = running.data ?? null;
  const elapsed = useElapsed(entry);
  const task = entry
    ? tasks.data?.find((t) => t.id === entry.taskId)
    : undefined;
  return {
    entry,
    elapsed,
    title: entry?.description ?? task?.title ?? "Trabajo del estudio",
  };
}

/**
 * Barra del temporizador para el celular: aparece solo con uno activo y queda sobre la navegación,
 * al alcance del pulgar. El botón de detener mide 48 px.
 */
export function TimerBar() {
  const { entry, elapsed, title } = useRunningTimer();
  const stop = useStopTimer();
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  if (!entry) return null;
  return (
    <div className="active-timer-mobile enter lg:hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          role="timer"
          aria-label="Tiempo transcurrido"
          className="num active-timer-clock"
        >
          {formatClock(elapsed)}
        </span>
        <span className="active-timer-title">{title}</span>
      </div>
      <Button
        variant="ghost"
        aria-label={
          entry.timerState === "paused"
            ? "Continuar temporizador"
            : "Pausar temporizador"
        }
        onClick={() =>
          entry.timerState === "paused" ? resume.mutate() : pause.mutate()
        }
      >
        {entry.timerState === "paused" ? (
          <Play size={16} />
        ) : (
          <Pause size={16} />
        )}
      </Button>
      <button
        type="button"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
        className="active-timer-stop"
      >
        <Square className="size-4 fill-current" aria-hidden="true" />
        Detener
      </button>
    </div>
  );
}

/** Chip del temporizador para el encabezado de escritorio. */
export function TimerChip() {
  const { entry, elapsed, title } = useRunningTimer();
  const stop = useStopTimer();
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  if (!entry) return null;
  return (
    <div className="active-timer-chip hidden lg:flex">
      <span className="active-timer-indicator">
        <Clock3 size={16} aria-hidden="true" />
      </span>
      <div className="active-timer-info">
        <span
          role="timer"
          aria-label="Tiempo transcurrido"
          className="num active-timer-clock"
        >
          {formatClock(elapsed)}
        </span>
        <span className="active-timer-title" data-tooltip={title}>
          {title}
        </span>
      </div>
      <Button
        variant="ghost"
        aria-label={
          entry.timerState === "paused"
            ? "Continuar temporizador"
            : "Pausar temporizador"
        }
        onClick={() =>
          entry.timerState === "paused" ? resume.mutate() : pause.mutate()
        }
      >
        {entry.timerState === "paused" ? (
          <Play size={16} />
        ) : (
          <Pause size={16} />
        )}
      </Button>
      <Button
        variant="ghost"
        aria-label="Detener temporizador"
        data-tooltip="Finalizar y preparar horas"
        className="active-timer-stop"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
      >
        <Square size={13} aria-hidden="true" />
        <span className="sr-only">Detener</span>
      </Button>
    </div>
  );
}
