import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCheck,
  FolderKanban,
  ListTodo,
  Receipt,
  Sun,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useProjectSummaries } from "@/features/projects/hooks/useProjectSummaries";
import { useExpenseOverview } from "@/features/expenses/hooks/useExpenseOverview";
import { useMembers } from "@/features/team/hooks/useMembers";
import { formatIsoDate, todayLima } from "@vexa/domain/dates";
import { formatMoney } from "@vexa/domain/format";
import { taskStatusLabel } from "@/lib/labels";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { attentionTasks } from "@vexa/domain/task-attention";

export function DashboardOperations({
  userId,
  team,
}: {
  userId: string;
  team?: ReactNode;
}) {
  const tasks = useTasks();
  const projects = useProjectSummaries();
  const expenses = useExpenseOverview();
  const members = useMembers();
  const [onlyMine, setOnlyMine] = useState(false);
  const summaries = projects.data ?? [];
  const sprints = summaries.flatMap((summary) =>
    summary.sprint ? [summary.sprint] : [],
  );
  const available = attentionTasks(
    tasks.data ?? [],
    summaries.map((p) => p.project),
    sprints,
    userId,
  );
  const focus = onlyMine
    ? available.filter((task) => task.assigneeId === userId)
    : available;
  const pending = (expenses.data?.expenses ?? [])
    .filter((expense) => expense.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const active = summaries.filter((p) => p.project.status === "active");
  const today = todayLima();
  const upcoming = (expenses.data?.recurringExpenses ?? [])
    .filter(
      (expense) =>
        expense.nextDate <=
        new Date(new Date(`${today}T12:00:00Z`).getTime() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
    )
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  let hasDraft = false;
  try {
    const draft = JSON.parse(
      localStorage.getItem(`vexa.daily-draft.${userId}.${today}`) ?? "null",
    );
    hasDraft = [draft?.done, draft?.next, draft?.blockers].some(
      (text) => typeof text === "string" && text.trim().length > 0,
    );
  } catch {
    /* El acceso a Mi día sigue disponible sin almacenamiento. */
  }

  const taskFailed = tasks.isError || projects.isError;
  const taskLoading = tasks.isLoading || projects.isLoading;
  return (
    <div className="dashboard-operations">
      <nav className="dashboard-module-strip" aria-label="Resumen de módulos">
        <span className="dashboard-shortcuts-label">También en el estudio</span>
        <Link to="/tareas">
          <ListTodo size={15} aria-hidden="true" />
          <span>
            Mis tareas
            <strong className="num">
              {taskFailed
                ? "—"
                : taskLoading
                  ? "…"
                  : available.filter((t) => t.assigneeId === userId).length}
            </strong>
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <Link to="/proyectos">
          <FolderKanban size={15} aria-hidden="true" />
          <span>
            Proyectos
            <strong className="num">
              {projects.isError
                ? "—"
                : projects.isLoading
                  ? "…"
                  : active.length}
            </strong>
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <Link to="/gastos?filter=pending">
          <Receipt size={15} aria-hidden="true" />
          <span>
            Gastos por revisar
            <strong className="num">
              {expenses.isError
                ? "—"
                : expenses.isLoading
                  ? "…"
                  : pending.length}
            </strong>
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <Link to="/mi-dia">
          <Sun size={15} aria-hidden="true" />
          <span>
            Mi día
            <strong className="dashboard-module-label">
              {hasDraft ? "Daily con borrador" : "Daily y foco"}
            </strong>
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </nav>
      <div className="dashboard-action-grid">
        <div className="dashboard-task-column">
          <section aria-labelledby="dashboard-attention">
            <Card className="dashboard-attention-card">
              <div className="dashboard-section-heading">
                <div>
                  <h2 id="dashboard-attention">Tareas por atender</h2>
                  <p>Primero los sprints que cierran antes y las revisiones.</p>
                </div>
                <div className="dashboard-scope" aria-label="Mostrar tareas">
                  <button
                    type="button"
                    aria-pressed={!onlyMine}
                    onClick={() => setOnlyMine(false)}
                  >
                    Equipo
                  </button>
                  <button
                    type="button"
                    aria-pressed={onlyMine}
                    onClick={() => setOnlyMine(true)}
                  >
                    Mías
                  </button>
                </div>
              </div>
              {taskFailed ? (
                <ErrorState
                  message="No se pudieron cargar las tareas."
                  onRetry={() => {
                    void tasks.refetch();
                    void projects.refetch();
                  }}
                />
              ) : taskLoading ? (
                <Skeleton className="h-40" />
              ) : focus.length ? (
                <ul className="dashboard-focus-list">
                  {focus.slice(0, 3).map((task) => {
                    const project = summaries.find(
                      (p) => p.project.id === task.projectId,
                    );
                    const sprint = sprints.find((s) => s.id === task.sprintId);
                    const closeLabel = sprint
                      ? sprint.endDate < today
                        ? "Sprint vencido"
                        : sprint.endDate === today
                          ? "Sprint cierra hoy"
                          : `Cierre de sprint ${formatIsoDate(sprint.endDate)}`
                      : "Sin sprint activo";
                    return (
                      <li key={task.id}>
                        <Link
                          to={
                            sprint ? `/proyectos/${task.projectId}` : "/tareas"
                          }
                        >
                          <span
                            className={`dashboard-task-mark is-${task.status}`}
                          >
                            <CheckCheck size={16} aria-hidden="true" />
                          </span>
                          <div>
                            <strong>{task.title}</strong>
                            <p>
                              {project?.project.name} ·{" "}
                              {task.assigneeId === userId
                                ? "Asignada a ti"
                                : (members.data
                                    ?.find((m) => m.id === task.assigneeId)
                                    ?.name.split(" ")[0] ??
                                  (task.assigneeId
                                    ? "Responsable asignado"
                                    : "Sin asignar"))}
                            </p>
                            <span>{closeLabel}</span>
                          </div>
                          <span className="dashboard-task-state">
                            {taskStatusLabel[task.status]}
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="dashboard-blank">
                  {onlyMine
                    ? "No tienes tareas abiertas en proyectos activos."
                    : "No hay tareas por atender en proyectos activos."}
                </p>
              )}
              <Link to="/tareas" className="dashboard-text-link">
                Ver mis tareas <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </Card>
          </section>
          <DashboardProjects />
        </div>
        <div className="dashboard-pending-column">
          <section aria-labelledby="dashboard-decisions">
            <Card className="dashboard-decisions-card">
              <div className="dashboard-section-heading">
                <div>
                  <h2 id="dashboard-decisions">Gastos por revisar</h2>
                  <p>Decisiones pendientes del estudio.</p>
                </div>
                <Receipt size={15} aria-hidden="true" />
              </div>
              {expenses.isError ? (
                <ErrorState
                  message="No se pudieron cargar los gastos."
                  onRetry={() => {
                    void expenses.refetch();
                  }}
                />
              ) : expenses.isLoading ? (
                <Skeleton className="h-32" />
              ) : pending.length ? (
                <ul className="dashboard-expense-list">
                  {pending.slice(0, 2).map((expense) => {
                    const votes =
                      expenses.data?.expenseVotes.filter(
                        (v) => v.expenseId === expense.id,
                      ) ?? [];
                    const mine = votes.find((v) => v.userId === userId);
                    return (
                      <li key={expense.id}>
                        <Link
                          to={`/gastos?filter=pending&expense=${encodeURIComponent(expense.id)}`}
                        >
                          <span className="dashboard-expense-meta">
                            <span>Pendiente de aprobación</span>
                            <strong className="num">
                              {formatMoney(expense.amount, expense.currency)}
                            </strong>
                          </span>
                          <strong>{expense.concept}</strong>
                          <span className="dashboard-expense-votes">
                            {votes.filter((v) => v.inFavor).length} votos a
                            favor · {mine ? "Ya votaste" : "Sin tu voto"}
                          </span>
                          <span className="dashboard-text-link">
                            Revisar gasto{" "}
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="dashboard-blank">
                  No hay gastos pendientes de aprobación.
                </p>
              )}
              {upcoming.length > 0 && (
                <Link className="dashboard-renewal" to="/gastos">
                  {upcoming[0].nextDate < today
                    ? "Renovación vencida"
                    : "Próxima renovación"}
                  : {upcoming[0].concept} ·{" "}
                  {formatIsoDate(upcoming[0].nextDate)}
                </Link>
              )}
              <p className="dashboard-local-note">
                {isSupabaseSource()
                  ? "Por ahora solo se pueden consultar los gastos; la votación aún no está habilitada."
                  : "La demo permite consultar los gastos; la votación aún no está habilitada."}
              </p>
            </Card>
          </section>
          {team}
        </div>
      </div>
    </div>
  );
}

export function DashboardProjects() {
  const projects = useProjectSummaries();
  const active =
    projects.data?.filter((summary) => summary.project.status === "active") ??
    [];
  return (
    <section aria-labelledby="dashboard-projects">
      <Card className="dashboard-projects-card">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="dashboard-projects">Proyectos en marcha</h2>
            <p>Avance del sprint activo o del proyecto.</p>
          </div>
        </div>
        {projects.isError ? (
          <ErrorState
            message="No se pudieron cargar los proyectos."
            onRetry={() => {
              void projects.refetch();
            }}
          />
        ) : projects.isLoading ? (
          <Skeleton className="h-28" />
        ) : active.length ? (
          <ul className="dashboard-project-list">
            {active.slice(0, 3).map((summary) => (
              <li key={summary.project.id}>
                <Link to={`/proyectos/${summary.project.id}`}>
                  <span>
                    <strong>{summary.project.name}</strong>
                    <span>
                      {summary.sprint
                        ? `Sprint hasta ${formatIsoDate(summary.sprint.endDate)}`
                        : "Sin sprint activo"}
                    </span>
                  </span>
                  <span className="num">
                    {summary.tasksByStatus.done}/{summary.taskCount}
                    <span> tareas hechas</span>
                  </span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-blank">No hay proyectos activos.</p>
        )}
        <Link to="/proyectos" className="dashboard-text-link">
          Ver proyectos <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </Card>
    </section>
  );
}
