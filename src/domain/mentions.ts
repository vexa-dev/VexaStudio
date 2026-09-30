import type { Id } from './types'

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Forma en que se escribe una mención: `@Rober` (primer nombre). */
export function mentionHandle(name: string): string {
  return `@${name.split(' ')[0]}`
}

/**
 * Personas mencionadas en un texto con `@PrimerNombre`. Ignora mayúsculas y tildes
 * (`@jose` menciona a José) y no repite a nadie.
 */
export function extractMentions(text: string, members: { id: Id; name: string }[]): Id[] {
  const byFirstName = new Map(members.map((m) => [normalize(m.name.split(' ')[0]), m.id]))
  const found = new Set<Id>()
  for (const match of text.matchAll(/@(\p{L}+)/gu)) {
    const id = byFirstName.get(normalize(match[1]))
    if (id) found.add(id)
  }
  return [...found]
}
