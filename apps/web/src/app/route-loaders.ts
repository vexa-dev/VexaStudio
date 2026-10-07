/** Dynamic imports of every screen: shared by `lazy()` in App.tsx and the intent prefetch. */
export const routeLoaders = {
  login: () => import("@/features/auth/pages/LoginPage"),
  reset: () => import("@/features/auth/pages/ResetPasswordPage"),
  profile: () => import("@/features/auth/pages/ProfilePage"),
  dashboard: () => import("@/features/dashboard/pages/DashboardPage"),
  expenses: () => import("@/features/expenses/pages/ExpensesPage"),
  projects: () => import("@/features/projects/pages/ProjectsPage"),
  activity: () => import("@/features/activity/pages/ActivityPage"),
  board: () => import("@/features/tasks/pages/BoardPage"),
  tasks: () => import("@/features/tasks/pages/TasksPage"),
  team: () => import("@/features/team/pages/TeamPage"),
  time: () => import("@/features/time/pages/TimePage"),
  day: () => import("@/features/day/MyDayPage"),
  layout: () => import("./AppLayout"),
} as const;

const loaderByPath: Record<string, () => Promise<unknown>> = {
  "/": routeLoaders.dashboard,
  "/mi-dia": routeLoaders.day,
  "/proyectos": routeLoaders.projects,
  "/tareas": routeLoaders.tasks,
  "/horas": routeLoaders.time,
  "/gastos": routeLoaders.expenses,
  "/equipo": routeLoaders.team,
  "/actividad": routeLoaders.activity,
  "/perfil": routeLoaders.profile,
};

const requested = new Set<string>();

/** Starts downloading a screen's chunk once; harmless for unknown paths or failures. */
export function prefetchRoute(path: string): void {
  const loader = loaderByPath[path];
  if (!loader || requested.has(path)) return;
  requested.add(path);
  loader().catch(() => requested.delete(path));
}

/** Pointer, keyboard focus and touch handlers that warm a nav link's chunk. */
export function prefetchHandlers(path: string) {
  const warm = () => prefetchRoute(path);
  return { onPointerEnter: warm, onFocus: warm, onTouchStart: warm };
}
