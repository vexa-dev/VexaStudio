import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { segmentLayout } from './segmented-bar-model'

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
  /** Short note shown when there is nothing to split (all values are 0). */
  emptyLabel?: string
  className?: string
}

const MIN_SEGMENT = '2.75rem'

/**
 * Reparto de un total entre varias personas. El segmento propio usa el verde de marca (salvo sin datos, donde todo es neutro) y los demás
 * un neutro; el significado no depende del color porque cada segmento se nombra debajo, con el mismo
 * ancho proporcional. La barra se revela de izquierda a derecha con `clip-path`.
 */
export function SegmentedBar({ segments, summary, animate = true, emptyLabel, className }: SegmentedBarProps) {
  const [revealed, setRevealed] = useState(!animate)
  useEffect(() => {
    if (!animate) return
    const frame = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(frame)
  }, [animate])

  const { empty, weights } = segmentLayout(segments.map((s) => s.value))
  const note = empty ? emptyLabel : undefined

  return (
    <div role="group" aria-label={note ? `${summary}. ${note}` : summary} className={cn('flex flex-col gap-2.5', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'flex h-5 w-full gap-1',
          animate && 'transition-[clip-path] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
        )}
        style={{ clipPath: revealed ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' }}
      >
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            className={cn('h-full rounded-md', !empty && segment.highlight ? 'bg-primary' : 'bg-segment')}
            style={{ flex: `${weights[index]} 1 0`, minWidth: MIN_SEGMENT }}
          />
        ))}
      </div>
      <ul className="flex w-full gap-1">
        {segments.map((segment, index) => (
          <li
            key={segment.id}
            className="min-w-0"
            style={{ flex: `${weights[index]} 1 0`, minWidth: MIN_SEGMENT }}
          >
            <p className={cn('truncate text-xs', segment.highlight ? 'font-semibold text-primary-text' : 'text-muted')}>
              {segment.label}
            </p>
            <p className="num text-sm font-semibold">{segment.caption}</p>
          </li>
        ))}
      </ul>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}
