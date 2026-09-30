import { Clock } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

export default function TimePage() {
  return (
    <>
      <PageHeader title="Horas" description="Registro de horas trabajadas." />
      <EmptyState
        icon={Clock}
        title="El registro de horas llega pronto"
        description="Aquí verás tus horas por semana y podrás registrar una manualmente."
      />
    </>
  )
}
