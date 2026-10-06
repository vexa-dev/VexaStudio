import { useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCheck,
  FolderKanban,
  ListTodo,
  Receipt,
  Sun,
  type LucideProps,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { ErrorState } from "@/components/ui/ErrorState";
import { Meter } from "@/components/ui/Meter";
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
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useFirstPlay } from "@/lib/useFirstPlay";
import { cn, stagger } from "@/lib/utils";
import {
  canSeeTeamTasks,
  pendingExpenseReview,
  projectProgressLabel,
  sprintProgressCaption,
  taskProjectLabel,
  taskSprintLabel,
} from "../dashboard-selectors";

type IconType = ComponentType<LucideProps>;

/** Same icon box, title and subtitle on every dashboard card, so headings line up. */
export function CardHeading({
  icon: Icon,
  id,
  title,
  subtitle,
  aside,
}: {
  icon: IconType;
  id: string;
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="dashboard-card-head">
      <span className="dashboard-card-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="dashboard-card-title">
        <h2 id={id}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {aside ? <div className="dashboard-card-aside">{aside}</div> : null}
    </div>
  );
}

/** "Ver más" link: always the last row of the card, with the arrow nudging on hover/focus. */
export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <div className="dashboard-card-foot">
      <Link to={to} className="dashboard-text-link">
        {children} <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

/** Counter that shows a placeholder while loading, a dash on error and counts up on first play. */
export function Figure({
  status,
  value,
  animate,
}: {
  status: "loading" | "error" | "ready";
  value: number;
  animate: boolean;
}) {
  if (status === "error") return <>—</>;
  if (status === "loading") return <>…</>;
  return <CountUp value={value} animate={animate} />;
}

export interface QuickLinkItem {
  to: string;
  icon: IconType;
  label: string;
  /** Counter or short text under the label. */
  value?: ReactNode;
}

/** 2x2 grid on phones, strip on tablets and slim column next to the hero cards on desktop. */
export function QuickLinks({
  ariaLabel,
  title,
  items,
  index,
}: {
  ariaLabel: string;
  title: string;
  items: QuickLinkItem[];
  index: number;
}) {
  return (
    <nav
      className="dashboard-quick enter"
      style={stagger(index)}
      aria-label={ariaLabel}
    >
      <span className="dashboard-quick-title">{title}</span>
      {items.map(({ to, icon: Icon, label, value }) => (
        <Link key={to} to={to}>
          <Icon size={16} aria-hidden="true" />
          <span className="dashboard-quick-text">
            {label}
            {value !== undefined ? <strong className="num">{value}</strong> : null}
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

export function DashboardOperations({
  userId,
  team,
  hero,
}: {
  userId: string;
  team?: ReactNode;
  /** Hours and participation cards; rendered with the quick links in the first tier. */
  hero?: ReactNode;
}) {
  const tasks = useTasks();
  const projects = useProjectSummaries();
  const expenses = useExpenseOverview();
  const members = useMembers();
  const { user } = useAuth();
  const [onlyMine, setOnlyMine] = useState(false);
  // The scope list fades only after the person changes tabs; the first paint uses the staggered entrance.
  const [swapped, setSwapped] = useState(false);
  const animate = useFirstPlay("dashboard");
  const switchScope = (mine: boolean) => {
    if (mine === onlyMine) return;
    setOnlyMine(mine);
    setSwapped(true);
  };
  // Non-admins only receive their own tasks, so the "Equipo" tab would repeat "Mías".
  const showScope = user ? canSeeTeamTasks(user.role) : false;
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
  const focus =
    onlyMine && showScope
      ? available.filter((task) => task.assigneeId === userId)
      : available;
  const review = pendingExpenseReview(
    expenses.data?.expenses ?? [],
    expenses.data?.expenseVotes ?? [],
    userId,
    2,
  );
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
  const taskStatus = taskFailed ? "error" : taskLoading ? "loading" : "ready";
  const myOpen = available.filter((t) => t.assigneeId === userId).length;
  return (
    <div className="dashboard-operations">
      <div className="dashboard-hero">
        {hero}
        <QuickLinks
          ariaLabel="Resumen de módulos"
          title="También en el estudio"
          index={3}
          items={[
            {
              to: "/tareas",
              icon: ListTodo,
              label: "Mis tareas",
              value: (
                <Figure status={taskStatus} value={myOpen} animate={animate} />
              ),
            },
            {
              to: "/proyectos",
              icon: FolderKanban,
              label: "Proyectos activos",
              value: (
                <Figure
                  status={
                    projects.isError
                      ? "error"
                      : projects.isLoading
                        ? "loading"
                        : "ready"
                  }
                  value={active.length}
                  animate={animate}
                />
              ),
            },
            {
              to: "/gastos?filter=pending",
              icon: Receipt,
              label: "Gastos por revisar",
              value: (
                <Figure
                  status={
                    expenses.isError
                      ? "error"
                      : expenses.isLoading
                        ? "loading"
                        : "ready"
                  }
                  value={review.total}
                  animate={animate}
                />
              ),
            },
            {
              to: "/mi-dia",
              icon: Sun,
              label: "Mi día",
              value: (
                <span className="dashboard-quick-note">
                  {hasDraft ? "Daily con borrador" : "Daily y foco"}
                </span>
              ),
            },
          ]}
        />
      </div>
      <div className="dashboard-body">
        <div className="dashboard-main-col">
          <section
            aria-labelledby="dashboard-attention"
            className="dashboard-block enter"
            style={stagger(4)}
          >
            <Card className="dashboard-attention-card">
              <CardHeading
                icon={ListTodo}
                id="dashboard-attention"
                title="Tareas por atender"
                subtitle="Primero los sprints que cierran antes y las revisiones."
                aside={
                  showScope ? (
                    <div className="dashboard-scope" aria-label="Mostrar tareas">
                      <button
                        type="button"
                        aria-pressed={!onlyMine}
                        onClick={() => switchScope(false)}
                      >
                        Equipo
                      </button>
                      <button
                        type="button"
                        aria-pressed={onlyMine}
                        onClick={() => switchScope(true)}
                      >
                        Mías
                      </button>
                    </div>
                  ) : null
                }
              />
              <div className="dashboard-list-slot">
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
                  <ul
                    key={onlyMine ? "mine" : "team"}
                    className={cn(
                      "dashboard-focus-list",
                      swapped && "dashboard-fade",
                    )}
                  >
                    {focus.slice(0, 3).map((task, i) => {
                      const project = summaries.find(
                        (p) => p.project.id === task.projectId,
                      );
                      const sprint = sprints.find((s) => s.id === task.sprintId);
                      const closeLabel = taskSprintLabel(sprint, today);
                      return (
                        <li
                          key={task.id}
                          className={cn(animate && !swapped && "enter")}
                          style={stagger(i)}
                        >
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
                                {taskProjectLabel(task, project?.project.name)}{" "}
                                ·{" "}
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
                  <p
                    key={onlyMine ? "mine" : "team"}
                    className={cn(
                      "dashboard-blank",
                      (animate || swapped) && "dashboard-fade",
                    )}
                  >
                    {onlyMine && showScope
                      ? "No tienes tareas abiertas en proyectos activos."
                      : "No hay tareas por atender en proyectos activos."}
                  </p>
                )}
              </div>
              <CardLink to="/tareas">Ver mis tareas</CardLink>
            </Card>
          </section>
          <DashboardProjects index={6} />
        </div>
        <div className="dashboard-side-col">
          <section
            aria-labelledby="dashboard-decisions"
            className="dashboard-block dashboard-block-expenses enter"
            style={stagger(4)}
          >
            <Card className="dashboard-decisions-card">
              <CardHeading
                icon={Receipt}
                id="dashboard-decisions"
                title="Gastos por revisar"
                subtitle="Decisiones pendientes del estudio."
              />
              <div className="dashboard-list-slot">
                {expenses.isError ? (
                  <ErrorState
                    message="No se pudieron cargar los gastos."
                    onRetry={() => {
                      void expenses.refetch();
                    }}
                  />
                ) : expenses.isLoading ? (
                  <Skeleton className="h-32" />
                ) : review.total ? (
                  <ul className="dashboard-expense-list">
                    {review.items.map(({ expense, inFavor, voted }, i) => (
                      <li
                        key={expense.id}
                        className={cn(animate && "enter")}
                        style={stagger(i)}
                      >
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
                            {inFavor} votos a favor ·{" "}
                            {voted ? "Ya votaste" : "Sin tu voto"}
                          </span>
                          <span className="dashboard-row-cta">
                            Revisar gasto{" "}
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={cn("dashboard-blank", animate && "dashboard-fade")}>
                    No hay gastos pendientes de aprobación.
                  </p>
                )}
              </div>
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
              <CardLink
                to={review.hidden > 0 ? "/gastos?filter=pending" : "/gastos"}
              >
                {review.hidden > 0
                  ? `Ver ${review.hidden} ${
                      review.hidden === 1
                        ? "gasto pendiente más"
                        : "gastos pendientes más"
                    }`
                  : "Ver gastos"}
              </CardLink>
            </Card>
          </section>
          {team}
        </div>
      </div>
    </div>
  );
}

export function DashboardProjects({ index = 6 }: { index?: number }) {
  const projects = useProjectSummaries();
  const animate = useFirstPlay("dashboard");
  const active =
    projects.data?.filter((summary) => summary.project.status === "active") ??
    [];
  return (
    <section
      aria-labelledby="dashboard-projects"
      className="dashboard-block dashboard-block-projects enter"
      style={stagger(index)}
    >
      <Card className="dashboard-projects-card">
        <CardHeading
          icon={FolderKanban}
          id="dashboard-projects"
          title="Proyectos en marcha"
          subtitle="Avance de tareas del sprint activo de cada proyecto."
        />
        <div className="dashboard-list-slot">
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
              {active.slice(0, 3).map((summary, i) => {
                const { progress } = summary;
                const caption = sprintProgressCaption(progress);
                return (
                  <li
                    key={summary.project.id}
                    className={cn(animate && "enter")}
                    style={stagger(i)}
                  >
                    <Link to={`/proyectos/${summary.project.id}`}>
                      <span className="dashboard-project-name">
                        <strong>{summary.project.name}</strong>
                        <span>
                          {summary.sprint
                            ? `Sprint hasta ${formatIsoDate(summary.sprint.endDate)}`
                            : "Sin sprint activo"}
                        </span>
                      </span>
                      <span className="dashboard-project-figure num">
                        {projectProgressLabel(progress)}
                        {caption ? <span> {caption}</span> : null}
                      </span>
                      <ArrowUpRight size={15} aria-hidden="true" />
                      {progress.total > 0 ? (
                        <Meter
                          value={progress.done}
                          max={progress.total}
                          label={`${progress.done} de ${progress.total} ${caption}`}
                          animate={animate}
                          className="dashboard-project-meter"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={cn("dashboard-blank", animate && "dashboard-fade")}>
              No hay proyectos activos.
            </p>
          )}
        </div>
        <CardLink to="/proyectos">Ver proyectos</CardLink>
      </Card>
    </section>
  );
}
