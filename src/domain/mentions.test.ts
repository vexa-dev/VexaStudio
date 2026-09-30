import { describe, expect, it } from 'vitest'
import { extractMentions, mentionHandle } from './mentions'

const members = [
  { id: 'u-jhony', name: 'Jhony Rivera' },
  { id: 'u-rober', name: 'Rober Vasquez' },
  { id: 'u-jose', name: 'José Gónzales' },
]

describe('extractMentions', () => {
  it('encuentra a las personas mencionadas por su primer nombre', () => {
    expect(extractMentions('Necesito el logo @Rober y la revisión de @Jhony', members)).toEqual(['u-rober', 'u-jhony'])
  })

  it('ignora mayúsculas y tildes', () => {
    expect(extractMentions('gracias @jose', members)).toEqual(['u-jose'])
    expect(extractMentions('gracias @JOSÉ', members)).toEqual(['u-jose'])
  })

  it('no repite a nadie y descarta nombres que no existen', () => {
    expect(extractMentions('@Rober @rober @Nadie', members)).toEqual(['u-rober'])
  })

  it('un texto sin menciones devuelve una lista vacía', () => {
    expect(extractMentions('correo a rober@vexa.space', members)).toEqual([])
  })
})

describe('mentionHandle', () => {
  it('escribe la mención con el primer nombre', () => {
    expect(mentionHandle('José Gónzales')).toBe('@José')
  })
})
