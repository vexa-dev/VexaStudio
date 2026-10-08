import { canAccessStudio } from "@vexa/domain/access";
import type { Role } from "@vexa/domain/types";
import {
  Clock,
  CalendarDays,
  History,
  Sun,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Visible en la barra inferior del móvil (máximo 5). */
  mobile: boolean;
}

export const navItems: NavItem[] = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, mobile: true },
  { to: "/mi-dia", label: "Mi día", icon: Sun, mobile: true },
  { to: "/proyectos", label: "Proyectos", icon: FolderKanban, mobile: true },
  { to: "/tareas", label: "Mis tareas", icon: ListChecks, mobile: true },
  { to: "/horas", label: "Horas", icon: Clock, mobile: true },
  { to: "/reuniones", label: "Reuniones", icon: CalendarDays, mobile: false },
  { to: "/gastos", label: "Gastos", icon: Wallet, mobile: true },
  { to: "/equipo", label: "Equipo", icon: Users, mobile: false },
  { to: "/actividad", label: "Actividad", icon: History, mobile: false },
];

export function navigationFor(role: Role | undefined) {
  return navItems.filter((item) =>
    ["/gastos", "/reuniones"].includes(item.to)
      ? role === "admin"
      : !["/equipo", "/actividad"].includes(item.to) || canAccessStudio(role),
  );
}
