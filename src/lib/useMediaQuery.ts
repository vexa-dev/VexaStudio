import { useSyncExternalStore } from 'react'

/** Coincidencia con una media query, actualizada al redimensionar. Sirve para elegir qué variante montar. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', callback)
      return () => media.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
