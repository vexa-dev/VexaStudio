import { Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { formatClock } from '@/lib/format'
import { useElapsed } from '../hooks/useElapsed'
import { useRunningEntry, useStopTimer } from '../hooks/useTime'

/** Datos del temporizador abierto, listos para mostrar en la barra (móvil) o el chip (escritorio). */
function useRunningTimer() {
  const running = useRunningEntry()
  const tasks = useTasks()
  const entry = running.data ?? null
  const elapsed = useElapsed(entry?.startedAt)
  const task = entry ? tasks.data?.find((t) => t.id === entry.taskId) : undefined
  return { entry, elapsed, title: task?.title ?? 'Tarea' }
}

/**
 * Barra del temporizador para el celular: aparece solo con uno activo y queda sobre la navegación,
 * al alcance del pulgar. El botón de detener mide 48 px.
 */
export function TimerBar() {
  const { entry, elapsed, title } = useRunningTimer()
  const stop = useStopTimer()
  if (!entry) return null
  return (
    <div className="enter fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-2xl bg-primary-solid p-2.5 pl-4 text-primary-fg shadow-pop lg:hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <span role="timer" aria-label="Tiempo transcurrido" className="num text-2xl font-bold leading-none">
          {formatClock(elapsed)}
        </span>
        <span className="mt-1 truncate text-sm opacity-90">{title}</span>
      </div>
      <button
        type="button"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
        className="flex h-12 items-center gap-2 rounded-xl bg-primary-fg px-4 text-sm font-semibold text-primary-solid disabled:opacity-60"
      >
        <Square className="size-4 fill-current" aria-hidden="true" />
        Detener
      </button>
    </div>
  )
}

/** Chip del temporizador para el encabezado de escritorio. */
export function TimerChip() {
  const { entry, elapsed, title } = useRunningTimer()
  const stop = useStopTimer()
  if (!entry) return null
  return (
    <div className="enter mr-2 hidden items-center gap-3 rounded-full border border-border bg-surface py-1 pl-4 pr-1 lg:flex">
      <span role="timer" aria-label="Tiempo transcurrido" className="num text-sm font-bold">
        {formatClock(elapsed)}
      </span>
      <span className="max-w-48 truncate text-sm text-muted">{title}</span>
      <Button size="sm" className="rounded-full" disabled={stop.isPending} onClick={() => stop.mutate()}>
        <Square className="size-3.5 fill-current" aria-hidden="true" />
        Detener
      </Button>
    </div>
  )
}
