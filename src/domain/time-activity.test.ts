import { describe, expect, it } from 'vitest'
import type { TimeEntry } from './types'
import { monthlyActivity } from './time-activity'

const entry: TimeEntry = {
  id:'session',userId:'me',taskId:null,source:'timer',hours:2,
  startedAt:'2026-10-01T04:30:00Z',endedAt:'2026-10-01T08:00:00Z',
  createdAt:'2026-10-01T08:00:00Z',paid:false,validated:true,validatedAt:'2026-10-01T09:00:00Z',voidedAt:null,voidReason:null,
  segments:[{start:'2026-10-01T04:30:00Z',end:'2026-10-01T05:30:00Z'},{start:'2026-10-01T07:00:00Z',end:'2026-10-01T08:00:00Z'}],
}
describe('sesiones confirmadas que atraviesan meses', () => {
  it('reparte solo tiempo activo por mes y no atribuye la pausa como trabajo', () => {
    const september = monthlyActivity([entry],'2026-09')
    const october = monthlyActivity([entry],'2026-10')
    expect(september.total).toBe(0.5)
    expect(october.total).toBe(1.5)
    expect(october.approved).toBe(1.5)
    expect(october.hourly[0]).toBe(0.5)
    expect(october.hourly[1]).toBe(0)
    expect(october.hourly[2]).toBe(1)
  })
  it('borradores y sesiones abiertas no se suman al resumen', () => {
    expect(monthlyActivity([{ ...entry,draft:true },{ ...entry,id:'running',endedAt:null }],'2026-10').total).toBe(0)
  })
})
