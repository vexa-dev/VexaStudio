import { ArrowLeft, Lock, Plus, Tags, Pencil } from "lucide-react";
import { CloseSprintSheet } from "../components/CloseSprintSheet";
import { useProjectSprints } from "../hooks/useSprintClose";
import { SprintFormSheet } from "../components/SprintFormSheet";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Meter } from "@/components/ui/Meter";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Task } from "@vexa/domain/types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import {
  useRunningEntry,
  useStartTimer,
  useStopTimer,
} from "@/features/time/hooks/useTime";
import { formatDate, formatIsoDate } from "@vexa/domain/dates";
import { useFirstPlay } from "@/lib/useFirstPlay";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "../components/KanbanBoard";
import { TaskContent } from "../components/TaskContent";
import { TaskFormSheet } from "../components/TaskFormSheet";
import { useTaskActions } from "../hooks/useTaskActions";
import { useActiveSprint, useProject, useTasks } from "../hooks/useTasks";

import { ProjectFormSheet } from "@/features/projects/components/ProjectFormSheet";
import { ProjectLabelsSheet } from "@/features/projects/components/ProjectLabelsSheet";

export default function BoardPage() {
  const { projectId = "" } = useParams();
  const { user } = useAuth();
  const project = useProject(projectId);
  const sprint = useActiveSprint(projectId);
  const tasks = useTasks({ projectId }, { enabled: Boolean(project.data) });
  const projectSprints = useProjectSprints(projectId);
  const members = useMembers();
  const running = useRunningEntry();
  const start = useStartTimer();
  const stop = useStopTimer();
  const animate = useFirstPlay("board");

  const [projectOpen, setProjectOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [sprintOpen, setSprintOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [detail, setDetail] = useState<Task>();
  const [onlyMine, setOnlyMine] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();

  const openTask = (task?: Task) => {
    if (user?.role !== "admin") {
      setDetail(task);
      return;
    }
    setEditing(task);
    setTaskOpen(true);
  };
  const { move } = useTaskActions(openTask);

  const backLink = (
    <Link
      to="/proyectos"
      className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-text"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Proyectos
    </Link>
  );

  if (project.isLoading || sprint.isLoading) {
    return (
      <>
        {backLink}
        <Skeleton className="mb-6 h-16" />
        <Skeleton className="h-72" />
      </>
    );
  }
  if (project.isError || sprint.isError || tasks.isError) {
    return (
      <>
        {backLink}
        <ErrorState
          message="No se pudo cargar el tablero."
          onRetry={() => {
            void project.refetch();
            void sprint.refetch();
            void tasks.refetch();
          }}
        />
      </>
    );
  }
  if (!project.data || !user) {
    return (
      <>
        {backLink}
        <EmptyState
          icon={ArrowLeft}
          title="No encontramos ese proyecto"
          description="Revisa el enlace o vuelve a la lista."
        />
      </>
    );
  }

  const activeSprint = sprint.data;
  // Sin sprint activo, el último cerrado se muestra de solo lectura (reporte guardado al cerrar).
  const lastClosed = activeSprint
    ? undefined
    : [...(projectSprints.data ?? [])]
        .filter((s) => s.status === "closed")
        .sort(
          (a, b) =>
            (b.closedAt ?? "").localeCompare(a.closedAt ?? "") ||
            b.endDate.localeCompare(a.endDate),
        )[0];
  const allTasks = tasks.data ?? [];
  const shown = onlyMine
    ? allTasks.filter((t) => t.assigneeId === user.id)
    : allTasks;
  const done = allTasks.filter((t) => t.status === "done").length;

  return (
    <>
      {backLink}
      <PageHeader
        title={project.data.name}
        description={
          activeSprint
            ? `${activeSprint.goal} · ${formatIsoDate(activeSprint.startDate)} al ${formatIsoDate(activeSprint.endDate)}`
            : "Tablero del proyecto. Las tareas no requieren un sprint."
        }
        actions={
          user.role === "admin" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setProjectOpen(true)}>
                <Pencil size={16} aria-hidden="true" />
                Editar proyecto
              </Button>
              <Button variant="secondary" onClick={() => setLabelsOpen(true)}>
                <Tags size={16} />
                Etiquetas
              </Button>
              {activeSprint && (
                <Button variant="secondary" onClick={() => setCloseOpen(true)}>
                  <Lock className="size-4" aria-hidden="true" />
                  Cerrar sprint
                </Button>
              )}
              <Button onClick={() => openTask()}>
                <Plus className="size-4" aria-hidden="true" />
                Nueva tarea
              </Button>
            </div>
          ) : undefined
        }
      />

      {user.role === "admin" && (
        <ProjectFormSheet
          open={projectOpen}
          onClose={() => setProjectOpen(false)}
          project={project.data}
        />
      )}
      {user.role === "admin" && (
        <ProjectLabelsSheet
          open={labelsOpen}
          onClose={() => setLabelsOpen(false)}
          projectId={projectId}
        />
      )}
      {user.role === "admin" && activeSprint && (
        <CloseSprintSheet
          open={closeOpen}
          onClose={() => setCloseOpen(false)}
          sprint={activeSprint}
          viewerId={user.id}
          canClose
        />
      )}
      {lastClosed && (
        <>
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm">
              <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                <span className="font-medium">Sprint cerrado:</span>{" "}
                {lastClosed.goal}
                {lastClosed.closedAt
                  ? ` · ${formatDate(lastClosed.closedAt)}`
                  : ""}
                . Sus horas validadas están bloqueadas.
              </span>
            </p>
            {user.role !== "collaborator" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReportOpen(true)}
              >
                Ver reporte
              </Button>
            )}
          </div>
          {user.role !== "collaborator" && (
            <CloseSprintSheet
              open={reportOpen}
              onClose={() => setReportOpen(false)}
              sprint={lastClosed}
              viewerId={user.id}
              canClose={false}
            />
          )}
        </>
      )}
      {user.role === "admin" && !activeSprint && (
        <Button
          variant="secondary"
          className="mb-4"
          onClick={() => setSprintOpen(true)}
        >
          Crear sprint (opcional)
        </Button>
      )}
      {user.role === "admin" && (
        <SprintFormSheet
          open={sprintOpen}
          projectId={projectId}
          onClose={() => setSprintOpen(false)}
        />
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="num text-sm text-muted">
            <span className="font-semibold text-fg">{done}</span> de{" "}
            {allTasks.length} tareas hechas
          </p>
          <Meter
            value={done}
            max={Math.max(allTasks.length, 1)}
            label={`${done} de ${allTasks.length} tareas hechas`}
            className="h-2 sm:max-w-xs"
            animate={animate}
          />
        </div>
        <button
          type="button"
          aria-pressed={onlyMine}
          onClick={() => setOnlyMine((v) => !v)}
          className={cn(
            "min-h-11 self-start rounded-full border px-4 text-sm font-medium",
            onlyMine
              ? "border-primary bg-primary-soft text-primary-text"
              : "border-border bg-surface text-muted",
          )}
        >
          Solo mis tareas
        </button>
      </div>

      {tasks.isLoading ? (
        <Skeleton className="h-72" />
      ) : allTasks.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="El sprint aún no tiene tareas"
          description="Crea la primera y asígnala a quien la va a trabajar."
          action={
            user.role === "admin" ? (
              <Button onClick={() => openTask()}>Nueva tarea</Button>
            ) : undefined
          }
        />
      ) : (
        <KanbanBoard
          readOnly={user.role !== "admin"}
          allowTimer={false}
          tasks={shown}
          members={members.data ?? []}
          currentUserId={user.id}
          runningTaskId={running.data?.taskId ?? null}
          busy={start.isPending || stop.isPending}
          onOpen={openTask}
          onMove={move}
          onStart={(task) => start.mutate(task.id)}
          onStop={() => stop.mutate()}
        />
      )}

      {user.role !== "admin" && (
        <p className="mt-4 text-sm text-muted">
          Tablero de consulta. Mueve tus tareas desde Mis tareas.
        </p>
      )}
      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        title="Detalle de tarea"
      >
        {detail && (
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">{detail.title}</h3>
            <p className="text-sm text-muted">
              Responsable:{" "}
              {members.data?.find((m) => m.id === detail.assigneeId)?.name ??
                "Sin responsable"}
            </p>
            <p>{detail.estimateHours ?? "Sin"} horas estimadas</p>
            <TaskContent task={detail} />
            {detail.link && (
              <a
                className="text-primary-text"
                href={detail.link}
                target="_blank"
                rel="noreferrer"
              >
                Abrir entregable ↗
              </a>
            )}
          </div>
        )}
      </Sheet>
      {user.role === "admin" && (
        <TaskFormSheet
          key={editing?.id ?? "new"}
          open={taskOpen}
          task={editing}
          projectId={projectId}
          sprintId={activeSprint?.id ?? null}
          onClose={() => setTaskOpen(false)}
        />
      )}
    </>
  );
}
