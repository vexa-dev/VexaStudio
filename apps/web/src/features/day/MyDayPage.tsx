import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ListTodo,
  Play,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useTimeHistory } from "@/features/time/hooks/useTime";
import { creditedActivity } from "@/features/time/analytics";
import { ChoicePicker } from "@/features/time/components/TimePickers";
import { todayLima } from "@vexa/domain/dates";
import { formatHours } from "@vexa/domain/format";
import { taskStatusLabel } from "@/lib/labels";
import { AnnouncementsCard } from "@/features/announcements/components/AnnouncementsCard";
import { DayDaily } from "./DayDaily";
import { DayFocus } from "./DayFocus";
import { readLocal, writeLocal, type DayPriority } from "./day-storage";
import "@/features/time/pages/time.css";
import "./day.css";
function DayWorkspace({ userId, day }: { userId: string; day: string }) {
  const key = `vexa.day-plan.${userId}.${day}`;
  const navigate = useNavigate();
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
  const [taskChoice, setTaskChoice] = useState("");
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
  function save(next: DayPriority[]) {
    setPlan(next);
    setNotice(
      writeLocal(key, next)
        ? "Plan guardado"
        : "No se pudo guardar el plan; disponible solo en esta sesión.",
    );
  }
  function add() {
    if (plan.length >= 3) return;
    const task = active.find((t) => t.id === taskChoice);
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
    setTaskChoice("");
  }
  return (
    <div className="my-day-workspace">
      <div className="day-work-layout">
        <div className="day-plan-column">
          <Card className="day-plan-card">
            <div className="day-card-title">
              <div>
                <span className="day-eyebrow">Una cosa a la vez</span>
                <h2>
                  <ListTodo size={18} /> Tu plan de hoy
                </h2>
              </div>
              <span className="day-plan-count">
                {completed.length}/{plan.length} hechas
              </span>
            </div>
            <p className="day-note">
              Elige hasta tres prioridades. También puedes planear trabajo sin
              una tarea asignada.
            </p>
            <label className="flex flex-col gap-2 mb-4 text-sm">
              Meta de hoy
              <input
                className="min-h-11 rounded-lg border border-border bg-surface px-3"
                placeholder="¿Qué quieres haber logrado al terminar el día?"
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  writeLocal(goalKey, e.target.value);
                }}
              />
            </label>
            {plan.length > 0 ? (
              <ol className="day-plan-list">
                {plan.map((p, index) => {
                  const done = completed.includes(p);
                  return (
                    <li key={p.id} data-done={done}>
                      <button
                        className="day-complete"
                        aria-label={`${done ? "Reabrir" : "Completar"} ${p.title}`}
                        aria-pressed={done}
                        disabled={Boolean(
                          tasks.data?.some(
                            (t) => t.id === p.taskId && t.status === "done",
                          ),
                        )}
                        onClick={() =>
                          save(
                            plan.map((item) =>
                              item.id === p.id
                                ? { ...item, done: !done }
                                : item,
                            ),
                          )
                        }
                      >
                        {done ? <Check size={17} /> : index + 1}
                      </button>
                      <div>
                        <strong>{p.title}</strong>
                        <span>
                          {p.taskId
                            ? (projects.data?.find(
                                (project) => project.id === p.projectId,
                              )?.name ?? "Tarea asignada")
                            : "Actividad libre"}
                        </span>
                      </div>
                      {!done && (
                        <Button
                          variant="ghost"
                          className="day-work-link"
                          aria-label={`Trabajar en ${p.title}`}
                          onClick={() =>
                            navigate(
                              `/tareas${p.taskId ? `?tarea=${p.taskId}` : ""}`,
                            )
                          }
                        >
                          <Play size={15} /> Ir a tareas
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        aria-label={`Quitar ${p.title}`}
                        onClick={() =>
                          save(plan.filter((item) => item.id !== p.id))
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="day-plan-empty">
                <Target size={24} />
                <p>¿Qué haría que hoy sea un buen día?</p>
                <span>Añade tu primera prioridad.</span>
              </div>
            )}
            {plan.length < 3 ? (
              <form
                className="day-plan-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
              >
                <ChoicePicker
                  label="Añadir al plan"
                  value={taskChoice}
                  onChange={setTaskChoice}
                  options={[
                    { value: "", label: "Escribir una actividad libre" },
                    ...suggested.map((t) => ({
                      value: t.id,
                      label: `${t.title} · ${taskStatusLabel[t.status]}`,
                    })),
                  ]}
                />
                {!taskChoice && (
                  <label className="day-field">
                    Actividad
                    <input
                      className="daily-input"
                      value={activity}
                      maxLength={180}
                      onChange={(e) => setActivity(e.target.value)}
                      placeholder="Ej. Preparar propuesta para un cliente"
                    />
                  </label>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!taskChoice && activity.trim().length < 3}
                >
                  <Plus size={16} /> Añadir prioridad
                </Button>
              </form>
            ) : (
              <p className="day-note">
                Tu plan está completo. Quita una prioridad si necesitas
                cambiarla.
              </p>
            )}
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
              Completar una prioridad marca tu plan personal; no aprueba horas
              ni cambia el estado de la tarea.
            </p>
            <Link className="day-text-action" to="/tareas">
              Ver mis tareas <ArrowUpRight size={14} />
            </Link>
          </Card>
          <DayDaily userId={userId} today={day} />
        </div>
        <div className="day-work-column">
          <AnnouncementsCard />
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
          <DayFocus userId={userId} />
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
    <>
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
    </>
  );
}
