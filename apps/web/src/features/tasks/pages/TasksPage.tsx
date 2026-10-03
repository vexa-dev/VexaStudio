import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Task } from "@vexa/domain/types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useProjects } from "@/features/projects/hooks/useProjects";
import {
  useRunningEntry,
  useStartTimer,
  useStopTimer,
} from "@/features/time/hooks/useTime";
import { KanbanBoard } from "../components/KanbanBoard";
import { TaskContent } from "../components/TaskContent";
import { TaskFormSheet } from "../components/TaskFormSheet";
import { TaskTimer } from "../components/TaskTimer";
import { useTasks, useMoveTask } from "../hooks/useTasks";
import { taskStatusLabel } from "@/lib/labels";

export default function TasksPage() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const [onlyMine, setOnlyMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task>();
  const [detail, setDetail] = useState<Task>();
  const tasks = useTasks();
  const [params] = useSearchParams();
  const focused = useRef("");
  const selectedId = params.get("tarea") ?? "";
  useEffect(() => {
    if (
      !selectedId ||
      focused.current === selectedId ||
      !tasks.data?.some((t) => t.id === selectedId)
    )
      return;
    const card = document.querySelector(
      `[data-task-id="${CSS.escape(selectedId)}"]`,
    );
    if (card) {
      card.scrollIntoView({ block: "center", inline: "nearest" });
      focused.current = selectedId;
    }
  }, [selectedId, tasks.data]);
  const projects = useProjects();
  const members = useMembers();
  const running = useRunningEntry();
  const start = useStartTimer();
  const stop = useStopTimer();
  const move = useMoveTask();
  const shown = (tasks.data ?? []).filter(
    (t) => !onlyMine || t.assigneeId === user?.id,
  );
  return (
    <>
      <PageHeader
        title={admin ? "Tareas del equipo" : "Mis tareas"}
        description="Organiza tu trabajo. Al terminar una tarea, revisa y confirma sus horas en Horas."
        actions={
          admin ? (
            <Button
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              <Plus size={16} /> Nueva tarea
            </Button>
          ) : undefined
        }
      />
      <TaskTimer />
      {admin && (
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant={onlyMine ? "primary" : "secondary"}
            onClick={() => setOnlyMine(!onlyMine)}
            aria-pressed={onlyMine}
          >
            Solo mis tareas
          </Button>
          <span className="text-sm text-muted">
            {shown.length} tareas · incluye tareas sin proyecto
          </span>
        </div>
      )}
      {tasks.isLoading ? (
        <Skeleton className="h-72" />
      ) : tasks.isError ? (
        <ErrorState
          message="No se pudieron cargar las tareas."
          onRetry={() => tasks.refetch()}
        />
      ) : !shown.length ? (
        <EmptyState
          icon={ListChecks}
          title="Sin tareas asignadas"
          description="Aquí aparecerá el trabajo que te asigne un administrador."
        />
      ) : (
        <KanbanBoard
          tasks={shown}
          members={members.data ?? []}
          currentUserId={user?.id ?? ""}
          runningTaskId={running.data?.taskId ?? null}
          projectNames={Object.fromEntries(
            (projects.data ?? []).map((p) => [p.id, p.name]),
          )}
          busy={start.isPending || stop.isPending}
          onOpen={(task) => {
            if (admin) {
              setEditing(task);
              setOpen(true);
            } else setDetail(task);
          }}
          onMove={(task, status) => move.mutate({ id: task.id, status })}
          onStart={(task) => start.mutate(task.id)}
          onStop={() => stop.mutate()}
        />
      )}
      {admin && (
        <TaskFormSheet
          key={editing?.id ?? "new"}
          open={open}
          onClose={() => setOpen(false)}
          task={editing}
          projectId={editing?.projectId ?? null}
          sprintId={editing?.sprintId ?? null}
        />
      )}
      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        title="Detalle de tu tarea"
      >
        {detail && (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold">{detail.title}</h3>
            <p className="text-sm text-muted">
              {taskStatusLabel[detail.status]} · {detail.estimateHours ?? "Sin"}{" "}
              horas estimadas
            </p>
            <p className="text-sm">
              {detail.projectId
                ? (projects.data?.find((p) => p.id === detail.projectId)
                    ?.name ?? "Tarea asignada de otro proyecto")
                : "Sin proyecto"}
            </p>
            <TaskContent task={detail} />
            {detail.link && (
              <a
                href={detail.link}
                target="_blank"
                rel="noreferrer"
                className="text-primary-text"
              >
                Abrir entregable ↗
              </a>
            )}
            <Link to="/horas">Ver mis registros de horas ↗</Link>
          </div>
        )}
      </Sheet>
    </>
  );
}
