import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name.split(' ')[0]
  return (
    <>
      <PageHeader title={`Hola, ${firstName}`} description="Tu resumen de cumplimiento, puntos y participación." />
      <EmptyState
        icon={LayoutDashboard}
        title="El dashboard llega pronto"
        description="Aquí verás tus horas del mes, el cumplimiento y tu participación."
      />
    </>
  )
}
