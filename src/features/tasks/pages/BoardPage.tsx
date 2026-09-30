import { ArrowLeft, CalendarPlus, Flag, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Meter } from '@/components/ui/Meter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Task } from '@/domain/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useMembers } from '@/features/team/hooks/useMembers'
import { useRunningEntry, useStartTimer, useStopTimer } from '@/features/time/hooks/useTime'
import { formatIsoDate } from '@/lib/dates'
import { useFirstPlay } from '@/lib/useFirstPlay'
import { cn } from '@/lib/utils'
import { KanbanBoard } from '../components/KanbanBoard'
import { SprintFormSheet } from '../components/SprintFormSheet'
import { TaskFormSheet } from '../components/TaskFormSheet'
import { useTaskActions } from '../hooks/useTaskActions'
import { useActiveSprint, useProject, useTasks } from '../hooks/useTasks'

export default function BoardPage() {
  const { projectId = '' } = useParams()
  const { user } = useAuth()
  const project = useProject(projectId)
  const sprint = useActiveSprint(projectId)
  const sprintId = sprint.data?.id
  const tasks = useTasks({ sprintId }, { enabled: Boolean(sprintId) })
  const members = useMembers()
  const running = useRunningEntry()
  const start = useStartTimer()
  const stop = useStopTimer()
  const animate = useFirstPlay('board')

  const [onlyMine, setOnlyMine] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [editing, setEditing] = useState<Task | undefined>()
  const [sprintOpen, setSprintOpen] = useState(false)

  const openTask = (task?: Task) => {
    setEditing(task)
    setTaskOpen(true)
  }
  const { move } = useTaskActions(openTask)

  const backLink = (
    <Link
      to="/proyectos"
      className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-text"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Proyectos
    </Link>
  )

  if (project.isLoading || sprint.isLoading) {
    return (
      <>
        {backLink}
        <Skeleton className="mb-6 h-16" />
        <Skeleton className="h-72" />
      </>
    )
  }
  if (project.isError || sprint.isError || tasks.isError) {
    return (
      <>
        {backLink}
        <ErrorState
          message="No se pudo cargar el tablero."
          onRetry={() => {
            void project.refetch()
            void sprint.refetch()
            void tasks.refetch()
          }}
        />
      </>
    )
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
    )
  }

  const activeSprint = sprint.data
  if (!activeSprint) {
    return (
      <>
        {backLink}
        <PageHeader title={project.data.name} />
        <EmptyState
          icon={CalendarPlus}
          title="Este proyecto no tiene un sprint activo"
          description="Crea el sprint de las próximas 2 semanas para armar el tablero."
          action={
            <Button onClick={() => setSprintOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Crear sprint
            </Button>
          }
        />
        <SprintFormSheet open={sprintOpen} projectId={projectId} onClose={() => setSprintOpen(false)} />
      </>
    )
  }

  const allTasks = tasks.data ?? []
  const shown = onlyMine ? allTasks.filter((t) => t.assigneeId === user.id) : allTasks
  const done = allTasks.filter((t) => t.status === 'done').length

  return (
    <>
      {backLink}
      <PageHeader
        title={project.data.name}
        description={`${activeSprint.goal} · ${formatIsoDate(activeSprint.startDate)} al ${formatIsoDate(activeSprint.endDate)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/proyectos/${projectId}/cierre`}>
              <Button variant="secondary">
                <Flag className="size-4" aria-hidden="true" />
                Cierre de sprint
              </Button>
            </Link>
            <Button onClick={() => openTask()}>
              <Plus className="size-4" aria-hidden="true" />
              Nueva tarea
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="num text-sm text-muted">
            <span className="font-semibold text-fg">{done}</span> de {allTasks.length} tareas hechas
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
            'min-h-11 self-start rounded-full border px-4 text-sm font-medium',
            onlyMine ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-surface text-muted',
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
          action={<Button onClick={() => openTask()}>Nueva tarea</Button>}
        />
      ) : (
        <KanbanBoard
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

      <TaskFormSheet
        open={taskOpen}
        task={editing}
        projectId={projectId}
        sprintId={activeSprint.id}
        onClose={() => setTaskOpen(false)}
      />
    </>
  )
}
