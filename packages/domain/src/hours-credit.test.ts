import { describe, expect, it } from 'vitest'
import {
  complianceCredit,
  creditShare,
  entriesCreditedTo,
  MAX_PARTICIPANTS,
  normalizeParticipants,
  pointsCredit,
} from './hours-credit'
import { entryPoints } from './rules'
import type { TimeEntry } from './types'

const entry = {
  id: 'h1',
  userId: 'owner',
  hours: 2,
  paid: false,
  validated: true,
  voidedAt: null,
  draft: false,
  participants: [
    { userId: 'tag', sharePercent: 75 },
    { userId: 'full', sharePercent: 100 },
  ],
}

describe('creditShare', () => {
  it('da 100 al dueño, el porcentaje a quien está etiquetado y 0 al resto', () => {
    expect(creditShare(entry, 'owner')).toBe(100)
    expect(creditShare(entry, 'tag')).toBe(75)
    expect(creditShare(entry, 'full')).toBe(100)
    expect(creditShare(entry, 'other')).toBe(0)
  })
  it('un registro sin etiquetas (datos antiguos) solo acredita al dueño', () => {
    expect(creditShare({ ...entry, participants: undefined }, 'tag')).toBe(0)
  })
})

describe('pointsCredit', () => {
  it('acredita horas x porcentaje solo si está validado, no pagado y no anulado', () => {
    expect(pointsCredit(entry, 'tag')).toBe(1.5)
    expect(pointsCredit(entry, 'owner')).toBe(2)
    expect(pointsCredit({ ...entry, validated: false }, 'tag')).toBe(0)
    expect(pointsCredit({ ...entry, paid: true }, 'tag')).toBe(0)
    expect(pointsCredit({ ...entry, voidedAt: '2026-10-01T00:00:00Z' }, 'tag')).toBe(0)
    expect(pointsCredit({ ...entry, validated: false }, 'owner')).toBe(0)
  })
  it('entryPoints suma 20 puntos por hora acreditada a esa persona', () => {
    const settings = { pointsPerHour: 20 }
    expect(entryPoints(entry, settings)).toBe(40)
    expect(entryPoints(entry, settings, 'owner')).toBe(40)
    expect(entryPoints(entry, settings, 'tag')).toBe(30)
    expect(entryPoints(entry, settings, 'other')).toBe(0)
  })
})

describe('complianceCredit', () => {
  it('el dueño cuenta sus horas aunque estén pendientes; la persona etiquetada, solo validadas', () => {
    const pending = { ...entry, validated: false }
    expect(complianceCredit(pending, 'owner')).toBe(2)
    expect(complianceCredit(pending, 'tag')).toBe(0)
    expect(complianceCredit(entry, 'tag')).toBe(1.5)
  })
  it('lo pagado sigue contando para el mínimo; lo anulado y los borradores no', () => {
    const paid = { ...entry, paid: true }
    expect(complianceCredit(paid, 'tag')).toBe(1.5)
    expect(complianceCredit({ ...entry, voidedAt: '2026-10-01T00:00:00Z' }, 'tag')).toBe(0)
    expect(complianceCredit({ ...entry, draft: true }, 'owner')).toBe(0)
  })
})

describe('entriesCreditedTo', () => {
  it('devuelve los registros propios y, escalados, los de quien lo etiquetó', () => {
    const own = { ...entry, id: 'own', userId: 'tag', hours: 1 } as TimeEntry
    const tagged = entry as unknown as TimeEntry
    const pending = { ...entry, id: 'p', validated: false } as unknown as TimeEntry
    const result = entriesCreditedTo([own, tagged, pending], 'tag')
    expect(result.map((e) => [e.id, e.hours])).toEqual([
      ['own', 1],
      ['h1', 1.5],
    ])
  })
})

describe('normalizeParticipants', () => {
  const active = (id: string) => id !== 'gone'
  it('completa el porcentaje por defecto en 100 y conserva el orden', () => {
    expect(
      normalizeParticipants([{ userId: 'a' }, { userId: 'b', sharePercent: 40 }], 'owner', active),
    ).toEqual([
      { userId: 'a', sharePercent: 100 },
      { userId: 'b', sharePercent: 40 },
    ])
    expect(normalizeParticipants(undefined, 'owner', active)).toEqual([])
  })
  it('rechaza autoetiqueta, duplicados, porcentajes inválidos, inactivos y más de 10', () => {
    expect(() => normalizeParticipants([{ userId: 'owner' }], 'owner', active)).toThrow(
      'No puedes etiquetarte a ti mismo',
    )
    expect(() =>
      normalizeParticipants([{ userId: 'a' }, { userId: 'a' }], 'owner', active),
    ).toThrow('No repitas a una persona')
    for (const sharePercent of [0, 101, 50.5, Number.NaN]) {
      expect(() => normalizeParticipants([{ userId: 'a', sharePercent }], 'owner', active)).toThrow(
        'El porcentaje debe ser un entero entre 1 y 100',
      )
    }
    expect(() => normalizeParticipants([{ userId: 'gone' }], 'owner', active)).toThrow(
      'La persona etiquetada no está disponible',
    )
    const many = Array.from({ length: MAX_PARTICIPANTS + 1 }, (_, i) => ({ userId: `p${i}` }))
    expect(() => normalizeParticipants(many, 'owner', active)).toThrow(
      'Puedes etiquetar hasta 10 personas',
    )
  })
})
