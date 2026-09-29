import {
  Clock,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Visible en la barra inferior del móvil (máximo 5). */
  mobile: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, mobile: true },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban, mobile: false },
  { to: '/tareas', label: 'Mis tareas', icon: ListChecks, mobile: true },
  { to: '/horas', label: 'Horas', icon: Clock, mobile: true },
  { to: '/gastos', label: 'Gastos', icon: Receipt, mobile: true },
  { to: '/equipo', label: 'Equipo', icon: Users, mobile: true },
]
