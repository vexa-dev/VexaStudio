"use client";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  Star,
  Sun,
  Target,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { taskStatusLabel } from "@/lib/labels";
import { motionTokens, springs, shouldAnimate } from "@/lib/motion-tokens";

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function FocusTimer() {
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const deadline = useRef(0);
  const reduced = useReducedMotion();
  const duration = mode === "focus" ? 25 * 60 : 5 * 60;
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0) {
        setRunning(false);
        setFinished(true);
      }
    };
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [running]);
  function choose(next: "focus" | "break") {
    setRunning(false);
    setFinished(false);
    setMode(next);
    setRemaining(next === "focus" ? 1500 : 300);
  }
  function toggle() {
    if (running) {
      setRemaining(
        Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
      );
      setRunning(false);
    } else {
      const time = remaining || duration;
      setRemaining(time);
      deadline.current = Date.now() + time * 1000;
      setRunning(true);
      setFinished(false);
    }
  }
  return (
    <Card className="focus-card flex flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Target size={18} /> Tu foco
        </h2>
        <span className="eyebrow">25 / 5</span>
      </div>
      <div className="segmented-control" aria-label="Tipo de sesión">
        <button aria-pressed={mode === "focus"} onClick={() => choose("focus")}>
          <Target size={15} /> Foco
        </button>
        <button aria-pressed={mode === "break"} onClick={() => choose("break")}>
          <Coffee size={15} /> Descanso
        </button>
      </div>
      <div className="focus-clock">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
          />
          <motion.circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="var(--primary-text)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={553}
            initial={false}
            animate={{ strokeDashoffset: 553 * (1 - remaining / duration) }}
            transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <div>
          <span className="focus-digits">
            {String(Math.floor(remaining / 60)).padStart(2, "0")}
            <span>:</span>
            {String(remaining % 60).padStart(2, "0")}
          </span>
          <p>
            {running
              ? "Una cosa a la vez."
              : finished
                ? "Sesión completada"
                : "Tu espacio para concentrarte"}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={toggle}>
          {running ? <Pause size={16} /> : <Play size={16} />}{" "}
          {running
            ? "Pausar"
            : remaining === duration || finished
              ? "Comenzar"
              : "Continuar"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => choose(mode)}
          aria-label="Reiniciar sesión"
        >
          <RotateCcw size={16} />
        </Button>
      </div>
      <output className="text-center text-xs text-muted">
        {finished
          ? "Listo. Tómate un respiro antes de continuar."
          : "Este foco es personal y no registra horas de trabajo."}
      </output>
    </Card>
  );
}

function Daily({ userId, day }: { userId: string; day: string }) {
  const key = `vexa.daily-draft.${userId}.${day}`;
  const [draft, setDraft] = useState(() =>
    read(key, { done: "", next: "", blockers: "" }),
  );
  const [status, setStatus] = useState("");
  const labels = {
    done: "¿Qué hiciste?",
    next: "¿Qué harás ahora?",
    blockers: "¿Hay algún bloqueo?",
  };
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setStatus("Guardado en este navegador");
    } catch {
      setStatus("No se pudo guardar. Conserva este texto antes de salir.");
    }
  }
  return (
    <Card className="daily-card">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 text-xl font-semibold">
            Tu daily
          </h2>
        </div>
        <Sun className="text-primary-text" size={22} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="grid gap-4"
      >
        {(Object.keys(labels) as Array<keyof typeof labels>).map((field) => (
          <label key={field} className="grid gap-2 text-sm font-medium">
            {labels[field]}
            <textarea
              maxLength={2000}
              rows={2}
              value={draft[field]}
              placeholder={
                field === "blockers"
                  ? "Sin bloqueos, o cuenta qué necesitas…"
                  : "Una actualización breve y concreta…"
              }
              onChange={(e) => {
                setDraft({ ...draft, [field]: e.target.value });
                setStatus("Cambios sin guardar");
              }}
              className="daily-input resize-y"
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-64 text-xs text-muted">
            Borrador local por día. Todavía no se comparte con el equipo.
          </p>
          <Button type="submit">
            <Check size={16} /> Guardar daily
          </Button>
        </div>
        <output className="min-h-4 text-xs text-primary-text">{status}</output>
      </form>
    </Card>
  );
}

export default function MyDayPage() {
  const { user } = useAuth();
  const tasks = useTasks({ assigneeId: user?.id }, { enabled: Boolean(user) });
  const projects = useProjects();
  const [today] = useState(() => new Date());
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const key = `vexa.priorities.${user?.id}`;
  const [priorities, setPriorities] = useState<string[]>(() => read(key, []));
  const [onlyPriority, setOnlyPriority] = useState(false);
  const [notice, setNotice] = useState("");
  const reduced = useReducedMotion();
  const active = (tasks.data ?? []).filter((t) => t.status !== "done");
  const visible = active.filter(
    (t) => !onlyPriority || priorities.includes(t.id),
  );
  function prioritize(id: string) {
    const next = priorities.includes(id)
      ? priorities.filter((value) => value !== id)
      : [...priorities, id];
    setPriorities(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setNotice("Prioridades guardadas en este navegador");
    } catch {
      setNotice("Prioridades disponibles solo en esta sesión");
    }
  }
  return (
    <>
      <header className="quiet-header">
        <div>
          <h1>Mi día</h1>
          <p className="quiet-caption">Haz espacio para tu próximo gran paso.</p>
        </div>
        <span className="quiet-date">
          {new Intl.DateTimeFormat("es-PE", {
            timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long",
          }).format(today)}
        </span>
      </header>
      <div className="day-grid">
        <Card className="priority-card">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="mt-1 text-xl font-semibold">
                Tus prioridades
              </h2>
            </div>
            <span className="count-pill">{active.length} pendientes</span>
          </div>
          <div className="segmented-control mb-5">
            <button
              aria-pressed={!onlyPriority}
              onClick={() => setOnlyPriority(false)}
            >
              Todas
            </button>
            <button
              aria-pressed={onlyPriority}
              onClick={() => setOnlyPriority(true)}
            >
              <Star size={14} /> Prioridades
            </button>
          </div>
          {tasks.isLoading ? (
            <Skeleton className="h-40" />
          ) : tasks.isError ? (
            <ErrorState
              message="No se pudieron cargar tus tareas."
              onRetry={() => void tasks.refetch()}
            />
          ) : visible.length === 0 ? (
            <div className="day-empty">
              <Check size={28} />
              <p>
                {onlyPriority
                  ? "Marca una estrella para dar prioridad a una tarea."
                  : "Todo en orden. No tienes tareas pendientes."}
              </p>
            </div>
          ) : (
            <ul className="priority-list">
              {visible.map((task) => (
                <motion.li
                  key={task.id}
                  initial={false}
                  whileHover={
                    reduced || !shouldAnimate() ? {} : { x: motionTokens.distance.sm / 2 }
                  }
                  transition={springs.snappy}
                >
                  <button
                    aria-label={`${priorities.includes(task.id) ? "Quitar prioridad a" : "Priorizar"} ${task.title}`}
                    aria-pressed={priorities.includes(task.id)}
                    onClick={() => prioritize(task.id)}
                    className="star-button"
                  >
                    <Star
                      size={18}
                      fill={
                        priorities.includes(task.id) ? "currentColor" : "none"
                      }
                    />
                  </button>
                  <Link
                    to={`/proyectos/${task.projectId}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="block text-sm font-semibold">
                      {task.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {projects.data?.find((p) => p.id === task.projectId)
                        ?.name ?? "Proyecto"}{" "}
                      · {taskStatusLabel[task.status]}
                    </span>
                  </Link>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </motion.li>
              ))}
            </ul>
          )}
          <output className="mt-4 min-h-4 text-xs text-muted">
            {notice ||
              "Las estrellas son prioridades personales, guardadas localmente."}
          </output>
          <Link
            to="/tareas"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-text"
          >
            Ver mis tareas <ArrowUpRight size={15} />
          </Link>
        </Card>
        <FocusTimer />
        {user && <Daily key={`${user.id}.${day}`} userId={user.id} day={day} />}
      </div>
    </>
  );
}
