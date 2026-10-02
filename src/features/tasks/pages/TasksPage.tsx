import { ListChecks } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Task, TaskStatus } from "@/domain/types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useMembers } from "@/features/team/hooks/useMembers";
import {
  useRunningEntry,
  useStartTimer,
  useStopTimer,
} from "@/features/time/hooks/useTime";
import { taskStatusLabel } from "@/lib/labels";
import { stagger } from "@/lib/utils";
import { TaskCard } from "../components/TaskCard";
import { TaskFormSheet } from "../components/TaskFormSheet";
import { useTaskActions } from "../hooks/useTaskActions";
import { useTasks } from "../hooks/useTasks";

const SECTIONS: TaskStatus[] = ["in_progress", "review", "todo"];

export default function TasksPage() {
  const { user } = useAuth();
  const tasks = useTasks({ assigneeId: user?.id }, { enabled: Boolean(user) });
  const projects = useProjects();
  const members = useMembers();
  const running = useRunningEntry();
  const start = useStartTimer();
  const stop = useStopTimer();
  const [editing, setEditing] = useState<Task | undefined>();
  const { move } = useTaskActions(setEditing);

  const mine = (tasks.data ?? []).filter((t) => t.sprintId !== null);
  const projectName = (id: string) =>
    projects.data?.find((p) => p.id === id)?.name;
  const done = mine.filter((t) => t.status === "done");

  const card = (task: Task, index: number) => (
    <li key={task.id} className="enter" style={stagger(index)}>
      <TaskCard
        task={task}
        assignee={members.data?.find((m) => m.id === task.assigneeId)}
        projectName={projectName(task.projectId)}
        canTrack
        isTracking={running.data?.taskId === task.id}
        busy={start.isPending || stop.isPending}
        onOpen={setEditing}
        onMove={move}
        onStart={(t) => start.mutate(t.id)}
        onStop={() => stop.mutate()}
      />
    </li>
  );

  return (
    <>
      <PageHeader
        title="Mis tareas"
        description="Lo que tienes asignado en los sprints activos. Inicia el temporizador con un toque."
      />

      {tasks.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : tasks.isError ? (
        <ErrorState
          message="No se pudieron cargar tus tareas."
          onRetry={() => tasks.refetch()}
        />
      ) : mine.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tienes tareas asignadas"
          description="Cuando te asignen una en un sprint activo aparecerá aquí."
          action={
            <Link to="/proyectos">
              <Button variant="secondary">Ver proyectos</Button>
            </Link>
          }
        />
      ) : (
        <div className="task-groups flex flex-col gap-6">
          {SECTIONS.map((status) => {
            const list = mine.filter((t) => t.status === status);
            if (list.length === 0) return null;
            return (
              <section key={status} aria-label={taskStatusLabel[status]}>
                <h2 className="mb-2 px-1 text-sm font-semibold text-muted">
                  {taskStatusLabel[status]}{" "}
                  <span className="num">· {list.length}</span>
                </h2>
                <ul className="grid gap-3 md:grid-cols-2">{list.map(card)}</ul>
              </section>
            );
          })}
          {done.length > 0 ? (
            <details>
              <summary className="min-h-11 cursor-pointer px-1 text-sm font-semibold text-muted">
                Hechas <span className="num">· {done.length}</span>
              </summary>
              <ul className="mt-2 grid gap-3 md:grid-cols-2">
                {done.map(card)}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      {editing ? (
        <TaskFormSheet
          open
          task={editing}
          projectId={editing.projectId}
          sprintId={editing.sprintId}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </>
  );
}
