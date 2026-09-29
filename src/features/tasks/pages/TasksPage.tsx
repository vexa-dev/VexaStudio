import { ListChecks } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Mis tareas" description="Tus tareas del sprint, con temporizador." />
      <EmptyState
        icon={ListChecks}
        title="El tablero llega pronto"
        description="Podrás iniciar el temporizador desde cada tarea y moverla por el kanban."
      />
    </>
  )
}
