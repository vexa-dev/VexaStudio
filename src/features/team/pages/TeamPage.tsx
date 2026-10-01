import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

export default function TeamPage() {
  return (
    <>
      <PageHeader title="Equipo" description="Daily, anuncios y reunión semanal." />
      <EmptyState
        icon={Users}
        title="La comunicación del equipo llega pronto"
        description="Aquí estarán el daily, los anuncios y la convocatoria de la reunión semanal."
      />
    </>
  )
}
