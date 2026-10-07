import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AppShellSkeleton } from '@/app/RouteSkeleton'
import { useAuth } from '../hooks/useAuth'

/** Protege las rutas privadas: sin sesión redirige al login y recuerda a dónde iba. */
export function AuthGuard() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AppShellSkeleton />
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}
