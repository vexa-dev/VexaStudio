import { Navigate, Outlet } from "react-router-dom";
import { canAccessStudio } from "@vexa/domain/access";
import { useAuth } from "../hooks/useAuth";

export function StudioGuard() {
  const { user } = useAuth();
  return canAccessStudio(user?.role) ? <Outlet /> : <Navigate to="/" replace />;
}
