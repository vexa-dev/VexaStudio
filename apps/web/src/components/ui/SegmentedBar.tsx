import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface Segment {
  id: string
  /** Nombre corto que se escribe bajo el segmento. */
  label: string
  /** Valor ya formateado que se escribe bajo el nombre, por ejemplo "31 %". */
  caption: string
  value: number
  /** Segmento propio: se pinta con el verde de marca. */
  highlight?: boolean
}

interface SegmentedBarProps {
  segments: Segment[]
  /** Texto para lectores de pantalla con el resumen del reparto. */
  summary: string
  /** Con `false` la barra aparece completa, sin recorrido. */
  animate?: boolean
  className?: string
}

const MIN_SEGMENT = '2.75rem'

/**
 * Reparto de un total entre varias personas. El segmento propio usa el verde de marca y los demás
 * un neutro; el significado no depende del color porque cada segmento se nombra debajo, con el mismo
 * ancho proporcional. La barra se revela de izquierda a derecha con `clip-path`.
 */
export function SegmentedBar({ segments, summary, animate = true, className }: SegmentedBarProps) {
  const [revealed, setRevealed] = useState(!animate)
  useEffect(() => {
    if (!animate) return
    const frame = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(frame)
  }, [animate])

  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const weight = (value: number) => (total === 0 ? 1 : Math.max(value, total * 0.02))

  return (
    <div role="group" aria-label={summary} className={cn('flex flex-col gap-2.5', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'flex h-5 w-full gap-1',
          animate && 'transition-[clip-path] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
        )}
        style={{ clipPath: revealed ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' }}
      >
        {segments.map((segment) => (
          <div
            key={segment.id}
            className={cn('h-full rounded-md', segment.highlight ? 'bg-primary' : 'bg-segment')}
            style={{ flex: `${weight(segment.value)} 1 0`, minWidth: MIN_SEGMENT }}
          />
        ))}
      </div>
      <ul className="flex w-full gap-1">
        {segments.map((segment) => (
          <li
            key={segment.id}
            className="min-w-0"
            style={{ flex: `${weight(segment.value)} 1 0`, minWidth: MIN_SEGMENT }}
          >
            <p className={cn('truncate text-xs', segment.highlight ? 'font-semibold text-primary-text' : 'text-muted')}>
              {segment.label}
            </p>
            <p className="num text-sm font-semibold">{segment.caption}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
