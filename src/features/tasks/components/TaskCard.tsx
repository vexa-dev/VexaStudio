import { ExternalLink, GripVertical, Play, Square } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import type { Profile, Task, TaskStatus } from '@/domain/types'
import { formatHours } from '@/lib/format'
import { taskStatusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

interface TaskCardProps {
  task: Task
  assignee?: Profile
  /** Nombre del proyecto, útil cuando la tarjeta se muestra fuera de su tablero. */
  projectName?: string
  /** El temporizador se inicia solo en tareas propias. */
  canTrack: boolean
  isTracking: boolean
  busy?: boolean
  /** Asa de arrastre (solo escritorio). */
  handle?: ReactNode
  dragging?: boolean
  onOpen: (task: Task) => void
  onMove: (task: Task, status: TaskStatus) => void
  onStart: (task: Task) => void
  onStop: () => void
}

export function TaskCard({
  task,
  assignee,
  projectName,
  canTrack,
  isTracking,
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
      className={cn(
        'glass-card task-card flex flex-col gap-3 rounded-xl border bg-surface p-3.5 shadow-card',
        isTracking ? 'border-primary' : 'border-border',
        dragging && 'shadow-pop',
      )}
    >
      <div className="flex items-start gap-2">
        {handle}
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-h-11 flex-1 text-left text-sm font-medium leading-snug"
        >
          {task.title}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        {projectName ? <span>{projectName}</span> : null}
        {assignee ? (
          <span className="flex items-center gap-1.5">
            <Avatar name={assignee.name} size="sm" />
            {assignee.name.split(' ')[0]}
          </span>
        ) : (
          <span>Sin responsable</span>
        )}
        {task.estimateHours !== null ? <span className="num">{formatHours(task.estimateHours)} est.</span> : null}
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

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`move-${task.id}`}>
          Mover «{task.title}» a
        </label>
        <select
          id={`move-${task.id}`}
          value={task.status}
          onChange={(e) => onMove(task, e.target.value as TaskStatus)}
          className="min-h-11 min-w-[7.5rem] flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm"
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {taskStatusLabel[status]}
            </option>
          ))}
        </select>
        {canTrack ? (
          isTracking ? (
            <Button size="sm" disabled={busy} onClick={onStop}>
              <Square className="size-3.5 fill-current" aria-hidden="true" />
              Detener
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onStart(task)}>
              <Play className="size-3.5 fill-current" aria-hidden="true" />
              Iniciar
            </Button>
          )
        ) : null}
      </div>
    </article>
  )
}

/** Asa para arrastrar; el resto de la tarjeta sigue siendo táctil y desplazable. */
export function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="Arrastrar tarea"
      className="-ml-1.5 flex min-h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted active:cursor-grabbing"
      {...props}
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  )
}
