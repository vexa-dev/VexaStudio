import type { Notification, Profile } from '@/domain/types'

export interface NotificationView {
  title: string
  detail?: string
  /** Pantalla a la que lleva el aviso. */
  to: string
}

const firstName = (members: Profile[], id: string | undefined) =>
  members.find((m) => m.id === id)?.name.split(' ')[0] ?? 'Alguien'

/** Texto y destino de cada aviso, a partir de su tipo y su payload. */
export function describeNotification(notification: Notification, members: Profile[]): NotificationView {
  const { type, payload } = notification
  switch (type) {
    case 'mention': {
      const who = firstName(members, payload.by)
      const where =
        payload.entity === 'daily'
          ? '/equipo?tab=daily'
          : payload.projectId
            ? `/proyectos/${payload.projectId}`
            : '/tareas'
      const place = payload.entity === 'daily' ? 'en su daily' : payload.entity === 'task' ? 'en una tarea' : 'en un comentario'
      return { title: `${who} te mencionó ${place}`, detail: payload.excerpt, to: where }
    }
    case 'expense_vote':
      return { title: 'Hay un gasto que necesita tu voto', to: '/gastos' }
    case 'expense_result':
      return {
        title: payload.status === 'approved' ? 'Tu gasto quedó aprobado' : 'Tu gasto quedó rechazado',
        to: '/gastos',
      }
    case 'daily_pending':
      return {
        title: 'Tu daily de hoy está pendiente',
        detail: '¿Qué hiciste, qué harás, qué te bloquea?',
        to: '/equipo?tab=daily',
      }
    case 'hours_missing':
      return { title: 'Aún te faltan horas por registrar esta semana', detail: 'Revísalas antes de que termine el domingo.', to: '/horas' }
    case 'renewal':
      return {
        title: `${payload.concept ?? 'Un gasto recurrente'} se renueva en ${payload.days ?? '?'} días`,
        to: '/gastos',
      }
    case 'meeting': {
      if (payload.kind === 'confirmed') return { title: 'La reunión de la semana está confirmada', to: '/equipo?tab=reunion' }
      if (payload.kind === 'pending_vote') {
        return { title: 'Responde la convocatoria de la reunión', detail: 'Marca en qué horarios puedes.', to: '/equipo?tab=reunion' }
      }
      return { title: 'Convocaron la reunión semanal', detail: 'Marca en qué horarios puedes.', to: '/equipo?tab=reunion' }
    }
  }
}
