import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Clock3,
  ListChecks,
  CheckCheck,
  FolderKanban,
  Sun,
} from "lucide-react";
import type { Profile } from "@vexa/domain/types";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { Meter } from "@/components/ui/Meter";
import { useFirstPlay } from "@/lib/useFirstPlay";
import { stagger } from "@/lib/utils";
import {
  CardHeading,
  CardLink,
  Figure,
  QuickLinks,
} from "./DashboardOperations";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useTimeHistory, useHoursDrafts } from "@/features/time/hooks/useTime";
import { creditedActivity } from "@/features/time/analytics";
import { formatMonthLabel, monthKey } from "@vexa/domain/dates";
import { formatHours } from "@vexa/domain/format";
import { taskStatusLabel } from "@/lib/labels";

/** Personal workspace: no partner summaries, financial data or team queries. */
export function CollaboratorDashboard({ user }: { user: Profile }) {
  const [month] = useState(() => monthKey(new Date()));
  const animate = useFirstPlay("dashboard");
  const tasks = useTasks({ assigneeId: user.id });
  const projects = useProjects();
  const history = useTimeHistory();
  const drafts = useHoursDrafts();
  const mine = (tasks.data ?? []).filter((t) => t.assigneeId === user.id);
  const open = mine.filter((t) => t.status !== "done");
  const done = mine.length - open.length;
  const counts = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const task of mine) counts[task.status]++;
  const activity = creditedActivity(history.data ?? [], user.id, month);
  const pendingDrafts = (drafts.data ?? []).filter((d) => d.userId === user.id);
  const assigned = (projects.data ?? []).filter((p) =>
    p.memberIds?.includes(user.id),
  );
  const projectName = (id: string | null) =>
    assigned.find((p) => p.id === id)?.name ??
    (id ? "Tarea de proyecto" : "Sin proyecto");
  const retry = () => {
    void tasks.refetch();
    void projects.refetch();
    void history.refetch();
    void drafts.refetch();
  };
  const failure = (
    <ErrorState message="No se pudo cargar tu información." onRetry={retry} />
  );
  return (
    <div className="studio-dashboard collaborator-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-period">{formatMonthLabel(month)}</p>
          <h1>Hola, {user.name.split(" ")[0]}</h1>
          <p className="dashboard-caption">
            Tus tareas, tus horas y tu próximo paso.
          </p>
        </div>
        <Link
          to="/mi-dia"
          className="dashboard-action dashboard-action-primary"
        >
          Organizar mi día <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <div className="dashboard-operations">
        <div className="dashboard-hero">
          <section
            aria-labelledby="collaborator-hours"
            className="dashboard-block enter"
            style={stagger(1)}
          >
            <Card className="dashboard-personal-card dashboard-hero-card">
              <CardHeading
                icon={Clock3}
                id="collaborator-hours"
                title="Tus horas este mes"
                subtitle="Personal"
              />
              {history.isError ? (
                failure
              ) : history.isLoading ? (
                <Skeleton className="dashboard-hero-skeleton" />
              ) : (
                <>
                  <div>
                    <p className="dashboard-hours num">
                      <CountUp
                        value={activity.total}
                        format={(v) => String(Number(v.toFixed(2)))}
                        animate={animate}
                      />
                      <span> h</span>
                    </p>
                    <p className="dashboard-caption">
                      Registradas en {activity.activeDays}{" "}
                      {activity.activeDays === 1
                        ? "día de actividad"
                        : "días de actividad"}
                    </p>
                  </div>
                  <dl className="dashboard-personal-stats">
                    <div>
                      <dt>Aprobadas</dt>
                      <dd className="num">{formatHours(activity.approved)}</dd>
                    </div>
                    <div>
                      <dt>En revisión</dt>
                      <dd className="num">
                        {formatHours(
                          Math.max(0, activity.total - activity.approved),
                        )}
                      </dd>
                    </div>
                  </dl>
                  <CardLink to="/horas?vista=resumen">Ver resumen</CardLink>
                </>
              )}
            </Card>
          </section>
          <section
            aria-labelledby="collaborator-progress"
            className="dashboard-block enter"
            style={stagger(2)}
          >
            <Card className="dashboard-personal-card dashboard-hero-card">
              <CardHeading
                icon={ListChecks}
                id="collaborator-progress"
                title="Tu avance en tareas"
                subtitle="Tareas asignadas a ti"
              />
              {tasks.isError ? (
                failure
              ) : tasks.isLoading ? (
                <Skeleton className="dashboard-hero-skeleton" />
              ) : (
                <>
                  <div>
                    <p className="dashboard-hours num">
                      <CountUp value={done} animate={animate} />
                      <span> / {mine.length}</span>
                    </p>
                    <p className="dashboard-caption">
                      {mine.length
                        ? "Tareas terminadas de las que tienes asignadas"
                        : "Aún no tienes tareas asignadas"}
                    </p>
                  </div>
                  <Meter
                    value={done}
                    max={Math.max(mine.length, 1)}
                    label={`${done} de ${mine.length} tareas terminadas`}
                    animate={animate}
                  />
                  <div className="collaborator-task-stats">
                    <span>
                      <strong className="num">{counts.todo}</strong> pendientes
                    </span>
                    <span>
                      <strong className="num">{counts.in_progress}</strong> en
                      progreso
                    </span>
                    <span>
                      <strong className="num">{counts.review}</strong> en
                      revisión
                    </span>
                  </div>
                </>
              )}
            </Card>
          </section>
          <QuickLinks
            ariaLabel="Accesos personales"
            title="Tu espacio"
            index={3}
            items={[
              {
                to: "/tareas",
                icon: ListChecks,
                label: "Mis tareas",
                value: (
                  <Figure
                    status={tasks.isLoading ? "loading" : "ready"}
                    value={open.length}
                    animate={animate}
                  />
                ),
              },
              {
                to: "/proyectos",
                icon: FolderKanban,
                label: "Proyectos",
                value: (
                  <Figure
                    status={projects.isLoading ? "loading" : "ready"}
                    value={assigned.length}
                    animate={animate}
                  />
                ),
              },
              { to: "/horas", icon: Clock3, label: "Mis horas" },
              { to: "/mi-dia", icon: Sun, label: "Mi día" },
            ]}
          />
        </div>
        <div className="dashboard-body">
          <div className="dashboard-main-col">
            <section
              aria-labelledby="collaborator-next"
              className="dashboard-block enter"
              style={stagger(4)}
            >
              <Card className="dashboard-attention-card">
                <CardHeading
                  icon={CheckCheck}
                  id="collaborator-next"
                  title="Tus próximas tareas"
                  subtitle="Continúa lo que tienes en marcha o elige tu siguiente tarea."
                />
                <div className="dashboard-list-slot">
                  {tasks.isError ? (
                    failure
                  ) : tasks.isLoading ? (
                    <Skeleton className="h-40" />
                  ) : open.length ? (
                    <ul className="dashboard-focus-list">
                      {[...open]
                        .sort(
                          (a, b) =>
                            Number(b.status === "in_progress") -
                              Number(a.status === "in_progress") ||
                            a.title.localeCompare(b.title, "es"),
                        )
                        .slice(0, 4)
                        .map((task, i) => (
                          <li
                            key={task.id}
                            className={animate ? "enter" : undefined}
                            style={stagger(i)}
                          >
                            <Link to="/tareas">
                              <span
                                className={`dashboard-task-mark is-${task.status}`}
                              >
                                <CheckCheck size={16} aria-hidden="true" />
                              </span>
                              <div>
                                <strong>{task.title}</strong>
                                <p>{projectName(task.projectId)}</p>
                              </div>
                              <span className="dashboard-task-state">
                                {taskStatusLabel[task.status]}
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p
                      className={
                        animate ? "dashboard-blank dashboard-fade" : "dashboard-blank"
                      }
                    >
                      No tienes tareas pendientes. Tu tablero está al día.
                    </p>
                  )}
                </div>
                <CardLink to="/tareas">Abrir mi tablero</CardLink>
              </Card>
            </section>
          </div>
          <div className="dashboard-side-col">
            <section
              aria-labelledby="collaborator-confirm"
              className="dashboard-block enter"
              style={stagger(4)}
            >
              <Card className="dashboard-decisions-card">
                <CardHeading
                  icon={Clock3}
                  id="collaborator-confirm"
                  title="Horas por confirmar"
                  subtitle="Revisa el tiempo preparado antes de enviarlo a aprobación."
                />
                <div className="dashboard-list-slot">
                  {drafts.isError ? (
                    failure
                  ) : drafts.isLoading ? (
                    <Skeleton className="h-24" />
                  ) : (
                    <>
                      <p className="collaborator-draft-count num">
                        <CountUp
                          value={pendingDrafts.length}
                          animate={animate}
                        />
                        <span>
                          {" "}
                          {pendingDrafts.length === 1
                            ? "registro preparado"
                            : "registros preparados"}
                        </span>
                      </p>
                      <p className="dashboard-caption">
                        {pendingDrafts.length
                          ? "Tus tareas terminadas y sesiones detenidas están listas en Horas."
                          : "Al terminar una tarea, encontrarás aquí sus horas para revisarlas."}
                      </p>
                    </>
                  )}
                </div>
                <CardLink to="/horas?vista=registro">Ir a mis horas</CardLink>
              </Card>
            </section>
            <section
              aria-labelledby="collaborator-projects"
              className="dashboard-block enter"
              style={stagger(5)}
            >
              <Card className="dashboard-projects-card">
                <CardHeading
                  icon={FolderKanban}
                  id="collaborator-projects"
                  title="Tus proyectos"
                  subtitle="Proyectos en los que formas parte del equipo."
                />
                <div className="dashboard-list-slot">
                  {projects.isError ? (
                    failure
                  ) : projects.isLoading ? (
                    <Skeleton className="h-24" />
                  ) : assigned.length ? (
                    <ul className="dashboard-project-list">
                      {assigned.slice(0, 3).map((project, i) => (
                        <li
                          key={project.id}
                          className={animate ? "enter" : undefined}
                          style={stagger(i)}
                        >
                          <Link to={`/proyectos/${project.id}`}>
                            <span className="dashboard-project-name">
                              <strong>{project.name}</strong>
                              <span>
                                {project.status === "active"
                                  ? "Activo"
                                  : project.status === "paused"
                                    ? "En pausa"
                                    : "Finalizado"}{" "}
                                · Tablero de consulta
                              </span>
                            </span>
                            <ArrowUpRight size={15} aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className={
                        animate ? "dashboard-blank dashboard-fade" : "dashboard-blank"
                      }
                    >
                      Aún no formas parte de un proyecto. Tus tareas sin
                      proyecto también aparecen en tu tablero.
                    </p>
                  )}
                </div>
                <CardLink to="/proyectos">Ver mis proyectos</CardLink>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
