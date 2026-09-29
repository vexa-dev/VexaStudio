import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'

interface CountUpProps {
  value: number
  format?: (value: number) => string
  /** Duración del recorrido en ms. */
  duration?: number
  /** Con `false` la primera vez muestra el valor final; los cambios posteriores sí se animan. */
  animate?: boolean
  className?: string
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * Cifra que cuenta hasta su valor. Es decorativa: lectores de pantalla reciben el valor final
 * de inmediato y, con movimiento reducido, se muestra el valor final sin recorrido.
 */
export function CountUp({ value, format = (v) => String(Math.round(v)), duration = 500, animate = true, className }: CountUpProps) {
  const reduce = useReducedMotion()
  const [animated, setAnimated] = useState(animate ? 0 : value)
  const from = useRef(animate ? 0 : value)
  const skipFirst = useRef(!animate)
  // Con movimiento reducido se muestra el valor final directamente, sin pasar por el estado animado.
  const shown = reduce ? value : animated

  useEffect(() => {
    if (reduce) return
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const current = origin + (value - origin) * easeOutExpo(t)
      from.current = current
      setAnimated(current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, reduce])

  return (
    <>
      <span aria-hidden="true" className={className}>
        {format(shown)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}
