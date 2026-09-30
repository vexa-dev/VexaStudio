import { ReasonSheet } from '@/components/ui/ReasonSheet'
import type { TimeEntry } from '@/domain/types'
import { formatHours } from '@/lib/format'
import { useVoidEntry } from '../hooks/useTime'

export function VoidEntrySheet({ entry, onClose }: { entry: TimeEntry | null; onClose: () => void }) {
  const voidEntry = useVoidEntry()
  return (
    <ReasonSheet
      open={entry !== null}
      onClose={onClose}
      title="Anular registro"
      description={
        entry
          ? `Nadie borra registros: al anular, el de ${formatHours(entry.hours)} deja de contar y queda en el historial con tu motivo.`
          : ''
      }
      placeholder="Por ejemplo: lo registré dos veces"
      confirmLabel="Anular registro"
      danger
      pending={voidEntry.isPending}
      onConfirm={(reason) => (entry ? voidEntry.mutateAsync({ id: entry.id, reason }) : Promise.resolve())}
    />
  )
}
