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
import type { Profile } from "@/domain/types";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Meter } from "@/components/ui/Meter";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useTimeHistory, useHoursDrafts } from "@/features/time/hooks/useTime";
import { monthlyActivity } from "@/domain/time-activity";
import { formatMonthLabel, monthKey } from "@/lib/dates";
import { formatHours } from "@/lib/format";
import { taskStatusLabel } from "@/lib/labels";

/** Personal workspace: no partner summaries, financial data or team queries. */
export function CollaboratorDashboard({ user }: { user: Profile }) {
  const [month] = useState(() => monthKey(new Date()));
  const tasks = useTasks({ assigneeId: user.id });
  const projects = useProjects();
  const history = useTimeHistory();
  const drafts = useHoursDrafts();
  const mine = (tasks.data ?? []).filter((t) => t.assigneeId === user.id);
  const open = mine.filter((t) => t.status !== "done");
  const done = mine.length - open.length;
  const counts = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const task of mine) counts[task.status]++;
  const activity = monthlyActivity(
    (history.data ?? []).filter((e) => e.userId === user.id),
    month,
  );
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
      <div className="dashboard-overview dashboard-metrics">
        <section aria-labelledby="collaborator-hours">
          <Card className="dashboard-personal-card">
            <div className="dashboard-card-heading">
              <h2 id="collaborator-hours">
                <span className="dashboard-metric-icon">
                  <Clock3 size={18} aria-hidden="true" />
                </span>
                Tus horas este mes
              </h2>
              <span className="dashboard-period-note">Personal</span>
            </div>
            {history.isError ? (
              failure
            ) : history.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <div>
                  <p className="dashboard-hours num">
                    {Number(activity.total.toFixed(2))}
                    <span> h</span>
                  </p>
                  <p className="dashboard-caption">
                    Registradas en {activity.activeDays}{" "}
                    {activity.activeDays === 1
                      ? "día de actividad"
                      : "días de actividad"}
                  </p>
                </div>
                <div className="dashboard-personal-bottom">
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
                  <Link
                    to="/horas?vista=resumen"
                    className="dashboard-text-link"
                  >
                    Ver resumen <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </>
            )}
          </Card>
        </section>
        <section aria-labelledby="collaborator-progress">
          <Card className="dashboard-personal-card">
            <div className="dashboard-card-heading">
              <h2 id="collaborator-progress">
                <span className="dashboard-metric-icon">
                  <ListChecks size={18} aria-hidden="true" />
                </span>
                Tu avance en tareas
              </h2>
            </div>
            {tasks.isError ? (
              failure
            ) : tasks.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <div>
                  <p className="dashboard-hours num">
                    {done}
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
                />
                <div className="collaborator-task-stats">
                  <span>
                    <strong>{counts.todo}</strong> pendientes
                  </span>
                  <span>
                    <strong>{counts.in_progress}</strong> en progreso
                  </span>
                  <span>
                    <strong>{counts.review}</strong> en revisión
                  </span>
                </div>
              </>
            )}
          </Card>
        </section>
      </div>
      <nav className="dashboard-module-strip" aria-label="Accesos personales">
        <span className="dashboard-shortcuts-label">Tu espacio</span>
        <Link to="/tareas">
          <ListChecks size={15} aria-hidden="true" />
          <span>
            Mis tareas <strong>{tasks.isLoading ? "…" : open.length}</strong>
          </span>
        </Link>
        <Link to="/proyectos">
          <FolderKanban size={15} aria-hidden="true" />
          <span>
            Proyectos{" "}
            <strong>{projects.isLoading ? "…" : assigned.length}</strong>
          </span>
        </Link>
        <Link to="/horas">
          <Clock3 size={15} aria-hidden="true" />
          <span>Mis horas</span>
        </Link>
        <Link to="/mi-dia">
          <Sun size={15} aria-hidden="true" />
          <span>Mi día</span>
        </Link>
      </nav>
      <div className="dashboard-action-grid">
        <div className="dashboard-task-column">
          <section aria-labelledby="collaborator-next">
            <Card className="dashboard-attention-card">
              <div className="dashboard-section-heading">
                <div>
                  <h2 id="collaborator-next">Tus próximas tareas</h2>
                  <p>
                    Continúa lo que tienes en marcha o elige tu siguiente tarea.
                  </p>
                </div>
              </div>
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
                    .map((task) => (
                      <li key={task.id}>
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
                <p className="dashboard-blank">
                  No tienes tareas pendientes. Tu tablero está al día.
                </p>
              )}
              <Link to="/tareas" className="dashboard-text-link">
                Abrir mi tablero <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </Card>
          </section>
        </div>
        <div className="dashboard-pending-column">
          <section aria-labelledby="collaborator-confirm">
            <Card className="dashboard-decisions-card">
              <div className="dashboard-section-heading">
                <div>
                  <h2 id="collaborator-confirm">Horas por confirmar</h2>
                  <p>
                    Revisa el tiempo preparado antes de enviarlo a aprobación.
                  </p>
                </div>
              </div>
              {drafts.isError ? (
                failure
              ) : drafts.isLoading ? (
                <Skeleton className="h-24" />
              ) : (
                <>
                  <p className="collaborator-draft-count num">
                    {pendingDrafts.length}
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
              <Link to="/horas?vista=registro" className="dashboard-text-link">
                Ir a mis horas <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </Card>
          </section>
          <section aria-labelledby="collaborator-projects">
            <Card className="dashboard-projects-card">
              <div className="dashboard-section-heading">
                <div>
                  <h2 id="collaborator-projects">Tus proyectos</h2>
                  <p>Proyectos en los que formas parte del equipo.</p>
                </div>
              </div>
              {projects.isError ? (
                failure
              ) : projects.isLoading ? (
                <Skeleton className="h-24" />
              ) : assigned.length ? (
                <ul className="dashboard-project-list">
                  {assigned.slice(0, 3).map((project) => (
                    <li key={project.id}>
                      <Link to={`/proyectos/${project.id}`}>
                        <span>
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
                <p className="dashboard-blank">
                  Aún no formas parte de un proyecto. Tus tareas sin proyecto
                  también aparecen en tu tablero.
                </p>
              )}
              <Link to="/proyectos" className="dashboard-text-link">
                Ver mis proyectos <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
