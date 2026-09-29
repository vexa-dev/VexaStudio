import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import LoginPage from '@/features/auth/pages/LoginPage'
import ProfilePage from '@/features/auth/pages/ProfilePage'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import ExpensesPage from '@/features/expenses/pages/ExpensesPage'
import ProjectsPage from '@/features/projects/pages/ProjectsPage'
import TasksPage from '@/features/tasks/pages/TasksPage'
import TeamPage from '@/features/team/pages/TeamPage'
import TimePage from '@/features/time/pages/TimePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="proyectos" element={<ProjectsPage />} />
          <Route path="tareas" element={<TasksPage />} />
          <Route path="horas" element={<TimePage />} />
          <Route path="gastos" element={<ExpensesPage />} />
          <Route path="equipo" element={<TeamPage />} />
          <Route path="perfil" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
