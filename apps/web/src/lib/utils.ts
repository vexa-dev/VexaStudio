import type { CSSProperties } from 'react'

/** Une clases CSS ignorando valores vacíos. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Iniciales para avatares: "Jhony Rivera" → "JR". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    // Skip separators such as "·" or "-": only words with a letter or digit count.
    .filter((part) => /[\p{L}\p{N}]/u.test(part))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** Orden de entrada de un elemento en una secuencia escalonada (ver clase `.enter` en index.css). */
export function stagger(index: number): CSSProperties {
  return { '--i': index } as CSSProperties
}
