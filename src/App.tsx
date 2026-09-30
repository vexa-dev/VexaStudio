import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { AuthGuard } from '@/features/auth/components/AuthGuard'

// Cada pantalla se carga al entrar en ella: el arranque no descarga el tablero ni el arrastre.
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage'))
const ProfilePage = lazy(() => import('@/features/auth/pages/ProfilePage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const ExpensesPage = lazy(() => import('@/features/expenses/pages/ExpensesPage'))
const ProjectsPage = lazy(() => import('@/features/projects/pages/ProjectsPage'))
const BoardPage = lazy(() => import('@/features/tasks/pages/BoardPage'))
const SprintClosePage = lazy(() => import('@/features/sprints/pages/SprintClosePage'))
const TasksPage = lazy(() => import('@/features/tasks/pages/TasksPage'))
const TeamPage = lazy(() => import('@/features/team/pages/TeamPage'))
const TimePage = lazy(() => import('@/features/time/pages/TimePage'))

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={null}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="proyectos" element={<ProjectsPage />} />
          <Route path="proyectos/:projectId" element={<BoardPage />} />
          <Route path="proyectos/:projectId/cierre" element={<SprintClosePage />} />
          <Route path="tareas" element={<TasksPage />} />
          <Route path="horas" element={<TimePage />} />
          <Route path="gastos" element={<ExpensesPage />} />
          <Route path="equipo" element={<TeamPage />} />
          <Route path="notificaciones" element={<NotificationsPage />} />
          <Route path="perfil" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
