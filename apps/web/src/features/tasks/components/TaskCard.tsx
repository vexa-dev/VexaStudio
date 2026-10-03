import {
  AlignLeft,
  ExternalLink,
  GripVertical,
  Play,
  Square,
} from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { Profile, Task, TaskStatus } from "@vexa/domain/types";
import { formatHours } from "@vexa/domain/format";
import { taskStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { TaskLabels } from "./TaskContent";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];

interface TaskCardProps {
  task: Task;
  assignee?: Profile;
  /** Nombre del proyecto, útil cuando la tarjeta se muestra fuera de su tablero. */
  projectName?: string;
  /** El temporizador se inicia solo en tareas propias. */
  canTrack: boolean;
  isTracking: boolean;
  readOnly?: boolean;
  busy?: boolean;
  /** Asa de arrastre (solo escritorio). */
  handle?: ReactNode;
  dragging?: boolean;
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onStart: (task: Task) => void;
  onStop: () => void;
}

export function TaskCard({
  task,
  assignee,
  projectName,
  canTrack,
  isTracking,
  readOnly,
  busy,
  handle,
  dragging,
  onOpen,
  onMove,
  onStart,
  onStop,
}: TaskCardProps) {
  return (
    <article
      data-task-id={task.id}
      className={cn(
        "task-card",
        isTracking && "task-card-active",
        dragging && "task-card-dragging",
      )}
    >
      <TaskLabels labels={task.labels} />
      <div className="flex items-start gap-2">
        {handle}
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="task-card-title"
        >
          {task.title}
        </button>
      </div>

      <div className="task-card-meta">
        {task.description?.trim() && (
          <span
            title="Tiene descripción"
            className="inline-flex items-center gap-1"
          >
            <AlignLeft size={14} />
            Descripción
          </span>
        )}
        {projectName ? <span>{projectName}</span> : null}
        {assignee ? (
          <span className="flex items-center gap-1.5">
            <Avatar
              name={assignee.name}
              size="sm"
              className="task-card-avatar"
            />
            {assignee.name.split(" ")[0]}
          </span>
        ) : (
          <span>Sin responsable</span>
        )}
        {task.estimateHours !== null ? (
          <span className="num">{formatHours(task.estimateHours)} est.</span>
        ) : null}
        {task.link ? (
          <a
            href={task.link}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-6 items-center gap-1 text-primary-text underline-offset-2 hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Enlace
          </a>
        ) : null}
      </div>

      <div className="task-card-actions">
        {readOnly ? (
          <span className="text-sm text-muted">
            {taskStatusLabel[task.status]}
          </span>
        ) : (
          <ChoicePicker
            label={`Mover «${task.title}» a`}
            hideLabel
            value={task.status}
            disabled={busy}
            onChange={(value) => onMove(task, value as TaskStatus)}
            options={STATUSES.map((status) => ({
              value: status,
              label: taskStatusLabel[status],
            }))}
          />
        )}
        {canTrack && task.status !== "done" ? (
          isTracking ? (
            <Button
              className="task-card-timer"
              size="sm"
              disabled={busy}
              onClick={onStop}
            >
              <Square className="size-3.5 fill-current" aria-hidden="true" />
              Detener
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="task-card-timer"
              disabled={busy}
              onClick={() => onStart(task)}
            >
              <Play className="size-3.5 fill-current" aria-hidden="true" />
              Iniciar
            </Button>
          )
        ) : null}
      </div>
    </article>
  );
}

/** Asa para arrastrar; el resto de la tarjeta sigue siendo táctil y desplazable. */
export function DragHandle(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      type="button"
      aria-label="Arrastrar tarea"
      className="task-card-drag-handle"
      {...props}
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  );
}
