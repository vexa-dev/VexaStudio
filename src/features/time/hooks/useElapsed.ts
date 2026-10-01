import { useEffect, useState } from 'react'

/** Milisegundos transcurridos desde `startedAt`, actualizados cada segundo. */
export function useElapsed(startedAt: string | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return startedAt ? now - new Date(startedAt).getTime() : 0
}
