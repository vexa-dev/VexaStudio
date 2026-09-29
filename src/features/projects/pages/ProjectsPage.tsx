import { FolderKanban } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Meter } from '@/components/ui/Meter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatIsoDate } from '@/lib/dates'
import { formatHours } from '@/lib/format'
import { projectStatusLabel, projectTypeLabel, taskStatusLabel } from '@/lib/labels'
import { stagger } from '@/lib/utils'
import { useProjectSummaries, type ProjectSummary } from '../hooks/useProjectSummaries'

const STATUS_ORDER = ['todo', 'in_progress', 'review', 'done'] as const

function ProjectCard({ summary }: { summary: ProjectSummary }) {
  const { project, sprint, tasksByStatus, taskCount, monthHours } = summary
  const done = tasksByStatus.done
  return (
    <Card tone="raised" className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>{projectTypeLabel[project.type]}</Badge>
          <Badge tone={project.status === 'active' ? 'success' : 'warning'}>
            {projectStatusLabel[project.status]}
          </Badge>
        </div>
      </div>

      {sprint ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{sprint.goal}</p>
            <p className="num text-xs text-muted">
              Sprint activo · {formatIsoDate(sprint.startDate)} al {formatIsoDate(sprint.endDate)}
            </p>
          </div>
          <Meter value={done} max={Math.max(taskCount, 1)} label={`${done} de ${taskCount} tareas hechas`} className="h-2" />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
            {STATUS_ORDER.map((status) => (
              <li key={status} className="flex justify-between gap-2">
                <span>{taskStatusLabel[status]}</span>
                <span className="num font-semibold text-fg">{tasksByStatus[status]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {project.status === 'paused' ? 'Proyecto en pausa, sin sprint activo.' : 'Sin sprint activo por ahora.'}
        </p>
      )}

      <p className="mt-auto border-t border-border pt-3 text-sm text-muted">
        Horas del equipo este mes: <span className="num font-semibold text-fg">{formatHours(monthHours)}</span>
      </p>
    </Card>
  )
}

export default function ProjectsPage() {
  const { data: summaries, isLoading, isError, refetch } = useProjectSummaries()

  return (
    <>
      <PageHeader title="Proyectos" description="Dónde está el equipo trabajando y cómo va el sprint de cada uno." />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="No se pudieron cargar los proyectos." onRetry={() => refetch()} />
      ) : summaries && summaries.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((summary, index) => (
            <li key={summary.project.id} className="enter" style={stagger(index + 1)}>
              <ProjectCard summary={summary} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FolderKanban} title="Aún no hay proyectos" description="Los proyectos del equipo aparecerán aquí." />
      )}
    </>
  )
}
