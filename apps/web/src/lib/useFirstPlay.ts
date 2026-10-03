import { useEffect, useState } from 'react'

/** Claves ya reproducidas durante esta sesión del navegador. */
const played = new Set<string>()

/**
 * `true` solo la primera vez que una pantalla se muestra en la sesión. Sirve para que las animaciones
 * de entrada de datos (barras, contadores) no se repitan en cada visita a una pantalla de uso diario.
 */
export function useFirstPlay(key: string): boolean {
  const [first] = useState(() => !played.has(key))
  useEffect(() => {
    played.add(key)
  }, [key])
  return first
}
