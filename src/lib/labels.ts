import type { Area, ExpenseCategory, ExpenseStatus, ProjectStatus, ProjectType, Role, TaskStatus } from '@/domain/types'

export const roleLabel: Record<Role, string> = {
  admin: 'Admin',
  partner: 'Socio',
  collaborator: 'Colaborador',
}

export const areaLabel: Record<Area, string> = {
  technical: 'Líder técnico',
  management_finance: 'Gestión y finanzas',
  commercial: 'Comercial',
  design_marketing: 'Diseño y marketing',
}

export const projectTypeLabel: Record<ProjectType, string> = {
  internal: 'Interno',
  product: 'Producto',
  client: 'Cliente',
}

export const projectStatusLabel: Record<ProjectStatus, string> = {
  active: 'Activo',
  paused: 'En pausa',
  archived: 'Archivado',
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: 'Pendiente',
  in_progress: 'En progreso',
  review: 'En revisión',
  done: 'Hecho',
}

export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  infrastructure: 'Infraestructura',
  software: 'Software',
  marketing: 'Marketing',
  legal: 'Legal',
  other: 'Otro',
}

export const expenseStatusLabel: Record<ExpenseStatus, string> = {
  pending: 'Pendiente de votos',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  voided: 'Anulado',
}
