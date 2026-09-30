import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface MeterProps {
  /** Valor actual. */
  value: number
  /** Valor que llena la barra por completo. */
  max: number
  /** Valor que marca el umbral (por ejemplo, el mínimo mensual). */
  threshold?: number
  /** Texto para lectores de pantalla, por ejemplo "32 h de 48 h mínimas". */
  label: string
  /** Con `false` la barra aparece ya llena, sin recorrido (por ejemplo, en visitas repetidas). */
  animate?: boolean
  className?: string
}

/**
 * Barra de progreso con marca de umbral. El relleno se revela con `clip-path`
 * (sin animar ancho), y el estado siempre se acompaña de texto fuera del componente.
 */
export function Meter({ value, max, threshold, label, animate = true, className }: MeterProps) {
  const [revealed, setRevealed] = useState(!animate)
  useEffect(() => {
    if (!animate) return
    const frame = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(frame)
  }, [animate])

  const ratio = Math.min(Math.max(value / max, 0), 1)
  const remaining = revealed ? (1 - ratio) * 100 : 100
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={label}
      className={cn('relative h-3 w-full rounded-full bg-surface-2 ring-1 ring-inset ring-segment', className)}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-primary',
          animate && 'transition-[clip-path] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
        )}
        style={{ clipPath: `inset(0 ${remaining}% 0 0 round 9999px)` }}
      />
      {threshold !== undefined ? (
        <div
          aria-hidden="true"
          className="absolute -bottom-1.5 -top-1.5 w-[3px] rounded-full bg-fg ring-2 ring-surface"
          style={{ left: `${Math.min((threshold / max) * 100, 100)}%` }}
        />
      ) : null}
    </div>
  )
}
