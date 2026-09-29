import { FolderKanban } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { projectStatusLabel, projectTypeLabel } from '@/lib/labels'
import { useProjects } from '../hooks/useProjects'

export default function ProjectsPage() {
  const { data: projects, isLoading, isError, refetch } = useProjects()

  return (
    <>
      <PageHeader title="Proyectos" description="Proyectos internos, productos y clientes de VEXA." />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="No se pudieron cargar los proyectos." onRetry={() => refetch()} />
      ) : projects && projects.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="flex h-full flex-col gap-3">
                <h2 className="font-display text-lg font-semibold">{project.name}</h2>
                <div className="flex flex-wrap gap-2">
                  <Badge>{projectTypeLabel[project.type]}</Badge>
                  <Badge tone={project.status === 'active' ? 'success' : 'warning'}>
                    {projectStatusLabel[project.status]}
                  </Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FolderKanban} title="Aún no hay proyectos" />
      )}
    </>
  )
}
