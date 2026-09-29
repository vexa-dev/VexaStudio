import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title = 'No se pudo cargar', message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-danger">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {message ? <p className="max-w-sm text-sm text-muted">{message}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  )
}
