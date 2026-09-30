import type { AuditAction, Id, NotificationType, Profile } from '@/domain/types'
import { getDb, getSessionUserId } from './db'

/** Quién actúa y cómo se deja constancia: helpers compartidos por los servicios del mock. */

export function currentUser(): Profile {
  const id = getSessionUserId()
  const user = getDb().profiles.find((p) => p.id === id && p.active)
  if (!user) throw new Error('Inicia sesión para continuar')
  return user
}

/** Crear tareas, sprints y gastos es de admin y socios; los colaboradores solo registran sus horas. */
export function currentPartner(): Profile {
  const user = currentUser()
  if (user.role === 'collaborator') throw new Error('Tu rol no permite esta acción')
  return user
}

/** Solo el product owner (rol admin) ejecuta lo que se vota o se cierra. */
export function currentAdmin(): Profile {
  const user = currentUser()
  if (user.role !== 'admin') throw new Error('Solo el product owner puede hacer esto')
  return user
}

export function newId(prefix: string): Id {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function audit(table: string, recordId: Id, action: AuditAction, before: unknown, after: unknown, userId: Id) {
  getDb().auditLog.push({
    id: newId('au'),
    table,
    recordId,
    action,
    before: before === null ? null : structuredClone(before),
    after: after === null ? null : structuredClone(after),
    userId,
    createdAt: new Date().toISOString(),
  })
}

/** Socios que votan gastos: activos y con rol de admin o socio. */
export function votingPartners(): Profile[] {
  return getDb().profiles.filter((p) => p.active && p.role !== 'collaborator')
}

/**
 * Deja un aviso in-app para una persona. Con un id fijo es idempotente (los recordatorios usan ids fijos para
 * no repetirse). En la etapa 2 esto lo hacen triggers y pg_cron, y el push llega por Web Push.
 */
export function notify(userId: Id, type: NotificationType, payload: Record<string, string>, id?: string) {
  const db = getDb()
  if (id && db.notifications.some((n) => n.id === id)) return
  db.notifications.push({
    id: id ?? newId('n'),
    userId,
    type,
    payload,
    read: false,
    createdAt: new Date().toISOString(),
  })
}
