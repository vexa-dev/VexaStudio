import { Wallet } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

export default function ExpensesPage() {
  return (
    <>
      <PageHeader title="Gastos" description="Gastos de VEXA y su aprobación." />
      <EmptyState
        icon={Wallet}
        title="Los gastos llegan pronto"
        description="Podrás registrar gastos con comprobante y votar los que superen S/ 50."
      />
    </>
  )
}
