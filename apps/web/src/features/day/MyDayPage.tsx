import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Square,
  ListTodo,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useProjects } from "@/features/projects/hooks/useProjects";
import {
  useTimeHistory,
  useRunningEntry,
  useStartTimer,
  useActivityTimer,
  usePauseTimer,
  useResumeTimer,
  useStopTimer,
} from "@/features/time/hooks/useTime";
import { useElapsed } from "@/features/time/hooks/useElapsed";
import { creditedActivity } from "@/features/time/analytics";
import { todayLima } from "@vexa/domain/dates";
import { formatClock, formatHours } from "@vexa/domain/format";
import { taskStatusLabel } from "@/lib/labels";
import { UpcomingMeetingsCard } from "@/features/meetings/UpcomingMeetingsCard";
import { DayDaily } from "./DayDaily";
import { DayWeekPulse } from "./DayWeekPulse";
import { DayFocus } from "./DayFocus";
import { readLocal, writeLocal, type DayPriority } from "./day-storage";
import "@/features/time/pages/time.css";
import "./day.css";
function DayWorkspace({ userId, day }: { userId: string; day: string }) {
  const key = `vexa.day-plan.${userId}.${day}`;
  const running = useRunningEntry();
  const elapsed = useElapsed(running.data);
  const startTimer = useStartTimer();
  const startActivity = useActivityTimer();
  const pauseTimer = usePauseTimer();
  const resumeTimer = useResumeTimer();
  const stopTimer = useStopTimer();
  const timerBusy =
    running.isLoading ||
    startTimer.isPending ||
    startActivity.isPending ||
    pauseTimer.isPending ||
    resumeTimer.isPending ||
    stopTimer.isPending;
  const [plan, setPlan] = useState<DayPriority[]>(() => {
    const saved = readLocal<DayPriority[]>(key, []);
    return Array.isArray(saved)
      ? saved
          .filter(
            (p) => p && typeof p.id === "string" && typeof p.title === "string",
          )
          .slice(0, 3)
      : [];
  });
  const goalKey = `vexa.day-goal.${userId}.${day}`;
  const [goal, setGoal] = useState(() => readLocal<string>(goalKey, ""));
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState("");
  const [taskPage, setTaskPage] = useState(0);
  const tasks = useTasks({ assigneeId: userId });
  const projects = useProjects();
  const history = useTimeHistory();
  const active = (tasks.data ?? []).filter((t) => t.status !== "done");
  const completed = plan.filter(
    (p) =>
      p.done ||
      tasks.data?.some((t) => t.id === p.taskId && t.status === "done"),
  );
  const pending = plan.filter((p) => !completed.includes(p));
  const stats = creditedActivity(history.data ?? [], userId, day.slice(0, 7));
  const todayHours = stats.daily[Number(day.slice(8)) - 1] ?? 0;
  const suggested = active.filter((t) => !plan.some((p) => p.taskId === t.id));
  const taskPageCount = Math.max(1, Math.ceil(suggested.length / 4));
  const currentTaskPage = Math.min(taskPage, taskPageCount - 1);
  const visibleTasks = suggested.slice(
    currentTaskPage * 4,
    currentTaskPage * 4 + 4,
  );
  const taskPager = (
    <div
      className="day-task-pagination"
      aria-label="Páginas de tareas pendientes"
    >
      <button
        type="button"
        aria-label="Tareas anteriores"
        data-tooltip="Tareas anteriores"
        disabled={currentTaskPage === 0}
        onClick={() => setTaskPage(currentTaskPage - 1)}
      >
        <ChevronLeft size={14} />
      </button>
      <span aria-live="polite">
        {currentTaskPage + 1} / {taskPageCount}
      </span>
      <button
        type="button"
        aria-label="Siguientes tareas"
        data-tooltip="Siguientes tareas"
        disabled={currentTaskPage === taskPageCount - 1}
        onClick={() => setTaskPage(currentTaskPage + 1)}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
  function save(next: DayPriority[]) {
    setPlan(next);
    const remaining = active.filter(
      (task) => !next.some((priority) => priority.taskId === task.id),
    ).length;
    setTaskPage(
      Math.min(currentTaskPage, Math.max(0, Math.ceil(remaining / 4) - 1)),
    );
    setNotice(
      writeLocal(key, next)
        ? "Plan guardado"
        : "No se pudo guardar el plan; disponible solo en esta sesión.",
    );
  }
  function add(taskId?: string) {
    if (plan.length >= 3) return;
    const task = active.find((t) => t.id === taskId);
    const title = task?.title ?? activity.trim();
    if (title.length < 3) {
      setNotice("Escribe una actividad de al menos 3 caracteres.");
      return;
    }
    save([
      ...plan,
      {
        id: crypto.randomUUID(),
        title,
        taskId: task?.id ?? null,
        projectId: task?.projectId ?? null,
        done: false,
      },
    ]);
    setActivity("");
  }
  const priorities = (
    <ol className="day-plan-list">
      {Array.from({ length: 3 }, (_, index) => {
        const p = plan[index];
        if (!p)
          return (
            <li className="day-priority-slot" key={`empty-${index}`}>
              <span className="day-slot-number">{index + 1}</span>
              <div>
                <strong>
                  {index === 0
                    ? "Tu primera prioridad"
                    : "Espacio para una prioridad"}
                </strong>
                <span>Elige lo que más importa hoy</span>
              </div>
            </li>
          );
        const done = completed.includes(p);
        const taskDone = tasks.data?.some(
          (t) => t.id === p.taskId && t.status === "done",
        );
        const tracking = Boolean(
          running.data &&
          (p.taskId
            ? running.data.taskId === p.taskId
            : !running.data.taskId &&
              running.data.description === p.title &&
              running.data.projectId === p.projectId),
        );
        const paused = running.data?.timerState === "paused";
        const timerLabel = tracking
          ? `${paused ? "Continuar" : "Pausar"} ${p.title}`
          : `Iniciar contador de ${p.title}`;
        return (
          <li key={p.id} data-done={done}>
            <button
              className="day-complete"
              aria-label={`${done ? "Reabrir" : "Completar"} ${p.title}`}
              aria-pressed={done}
              disabled={taskDone}
              onClick={() =>
                save(
                  plan.map((item) =>
                    item.id === p.id ? { ...item, done: !done } : item,
                  ),
                )
              }
            >
              {done ? <Check size={17} /> : index + 1}
            </button>
            <div>
              <strong data-tooltip={p.title}>{p.title}</strong>
              {tracking ? (
                <span className="day-priority-timer">
                  <span
                    role="timer"
                    aria-label={`Tiempo de ${p.title}`}
                    className="num"
                  >
                    {formatClock(elapsed)}
                  </span>
                  <span>{paused ? "En pausa" : "En curso"}</span>
                  <button
                    type="button"
                    disabled={timerBusy}
                    aria-label={`Finalizar contador de ${p.title}`}
                    data-tooltip="Finalizar y preparar horas"
                    onClick={() => stopTimer.mutate()}
                  >
                    <Square size={11} />
                  </button>
                </span>
              ) : (
                <span>
                  {p.taskId
                    ? (projects.data?.find(
                        (project) => project.id === p.projectId,
                      )?.name ?? "Tarea asignada")
                    : "Actividad libre"}
                </span>
              )}
            </div>
            {(!done || tracking) && (
              <Button
                variant="ghost"
                className="day-work-link"
                aria-label={timerLabel}
                data-tooltip={timerLabel}
                disabled={timerBusy}
                onClick={() => {
                  if (tracking) {
                    if (paused) resumeTimer.mutate();
                    else pauseTimer.mutate();
                  } else if (p.taskId) startTimer.mutate(p.taskId);
                  else
                    startActivity.mutate({
                      description: p.title,
                      projectId: p.projectId,
                    });
                }}
              >
                {tracking && !paused ? <Pause size={15} /> : <Play size={15} />}
              </Button>
            )}
            <Button
              variant="ghost"
              aria-label={`Quitar ${p.title}`}
              onClick={() => save(plan.filter((item) => item.id !== p.id))}
            >
              <Trash2 size={16} />
            </Button>
          </li>
        );
      })}
    </ol>
  );
  return (
    <div className="my-day-workspace">
      <div className="day-work-layout">
        <div className="day-plan-column">
          <Card className="day-plan-card">
            <div className="day-card-title">
              <div>
                <span className="day-eyebrow">Plan personal</span>
                <h2>
                  <ListTodo size={18} /> Tu plan de hoy
                </h2>
              </div>
              <span className="day-plan-count">
                {completed.length}/{plan.length} hechas
              </span>
            </div>
            <p className="day-note">Elige lo que merece tu atención hoy.</p>
            <label className="day-field day-goal-field">
              Meta de hoy
              <input
                className="min-h-11 rounded-lg border border-border bg-surface px-3"
                placeholder="Tu objetivo más importante de hoy"
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  writeLocal(goalKey, e.target.value);
                }}
              />
            </label>
            <div className="day-plan-body">
              <div className="day-plan-inputs">
                <fieldset
                  className="day-plan-entry"
                  disabled={plan.length >= 3}
                >
                  <form
                    className="day-plan-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      add();
                    }}
                  >
                    <span className="day-eyebrow">Actividad libre</span>
                    <label className="day-field">
                      Actividad
                      <input
                        className="daily-input"
                        value={activity}
                        maxLength={180}
                        onChange={(e) => setActivity(e.target.value)}
                        placeholder="Escribe una actividad"
                      />
                    </label>
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={activity.trim().length < 3}
                    >
                      <Plus size={16} />{" "}
                      {plan.length >= 3 ? "Plan completo" : "Añadir prioridad"}
                    </Button>
                  </form>
                </fieldset>
                <div className="day-inline-tasks">
                  <div className="day-inline-heading">
                    <span className="day-eyebrow">De tus pendientes</span>
                    {taskPager}
                  </div>
                  {visibleTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => add(task.id)}
                      disabled={plan.length >= 3}
                      aria-label={"Priorizar " + task.title}
                      data-tooltip={task.title}
                    >
                      <span>{task.title}</span>
                      <Plus size={14} />
                    </button>
                  ))}
                </div>
              </div>
              <section
                className="day-priorities-panel"
                aria-label="Tus tres prioridades"
              >
                <span className="day-eyebrow">Tus prioridades</span>
                {priorities}
              </section>
            </div>
            <section
              className="day-quick-priorities"
              aria-label="Tareas para priorizar"
            >
              <div className="day-quick-heading">
                <strong>Tareas para priorizar</strong>
                <div className="day-quick-navigation">
                  <span className="day-note">De tus pendientes</span>
                  {taskPager}
                </div>
              </div>
              <div className="day-quick-list">
                {visibleTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => add(task.id)}
                    disabled={plan.length >= 3}
                    aria-label={"Priorizar " + task.title}
                    data-tooltip={task.title}
                  >
                    <div>
                      <strong>{task.title}</strong>
                      <span>
                        {projects.data?.find(
                          (project) => project.id === task.projectId,
                        )?.name ?? "Tarea asignada"}{" "}
                        · {taskStatusLabel[task.status]}
                      </span>
                    </div>
                    <Plus size={16} />
                  </button>
                ))}
                {!suggested.length && (
                  <p className="day-note">
                    {tasks.isLoading
                      ? "Buscando tus tareas…"
                      : tasks.isError
                        ? "Tus tareas no están disponibles."
                        : plan.length >= 3
                          ? "Tus tres prioridades están listas. Quita una si necesitas cambiar tu enfoque."
                          : "No tienes tareas pendientes por añadir. Puedes planear una actividad libre."}
                  </p>
                )}
              </div>
            </section>
            {tasks.isLoading && <Skeleton className="h-6" />}
            {tasks.isError && (
              <ErrorState
                message="No se pudieron cargar las tareas."
                onRetry={() => void tasks.refetch()}
              />
            )}
            <output aria-live="polite" className="day-note">
              {notice}
            </output>
            <p className="day-note">
              Tu plan es personal. Usa el contador para registrar tu trabajo.
            </p>
            <Link className="day-text-action" to="/tareas">
              Ver mis tareas <ArrowUpRight size={14} />
            </Link>
          </Card>

          <DayDaily userId={userId} today={day} />
          <DayWeekPulse userId={userId} day={day} />
        </div>
        <div className="day-work-column">
          <DayFocus userId={userId} />
          <UpcomingMeetingsCard />
          <Card className="day-summary-card">
            <div className="day-card-title">
              <h2>Hoy, en un vistazo</h2>
              <span className="day-note">Lima</span>
            </div>
            <dl className="day-summary-stats">
              <div>
                <dt>Horas registradas</dt>
                <dd>
                  {history.isLoading
                    ? "…"
                    : history.isError
                      ? "—"
                      : formatHours(todayHours)}
                </dd>
              </div>
              <div>
                <dt>Prioridades hechas</dt>
                <dd>
                  {completed.length}
                  <span> / {plan.length}</span>
                </dd>
              </div>
            </dl>
            {history.isError && (
              <ErrorState
                message="No se pudo cargar el resumen."
                onRetry={() => void history.refetch()}
              />
            )}
            <p className="day-next">
              <span>Siguiente prioridad</span>
              <strong>
                {pending[0]?.title ??
                  (plan.length
                    ? "Plan completado"
                    : "Aún no has preparado tu plan")}
              </strong>
            </p>
            <Link to="/horas?vista=historial" className="day-text-action">
              Ver mis horas <ArrowUpRight size={14} />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function MyDayPage() {
  const { user } = useAuth();
  const [day, setDay] = useState(todayLima);
  useEffect(() => {
    const id = setInterval(() => setDay(todayLima()), 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="my-day-page">
      <header className="quiet-header">
        <div>
          <h1>Mi día</h1>
          <p className="quiet-caption">
            Planea lo importante, trabaja y cuenta tu avance.
          </p>
        </div>
        <span className="quiet-date">
          {new Intl.DateTimeFormat("es-PE", {
            timeZone: "America/Lima",
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(new Date(`${day}T12:00:00-05:00`))}
        </span>
      </header>
      {user && (
        <DayWorkspace key={`${user.id}.${day}`} userId={user.id} day={day} />
      )}
    </div>
  );
}
