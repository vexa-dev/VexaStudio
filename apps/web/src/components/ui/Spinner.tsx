import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ label = 'Cargando…', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </span>
  )
}
