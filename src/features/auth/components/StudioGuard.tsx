import { Navigate, Outlet } from "react-router-dom";
import { canAccessStudio } from "@/domain/access";
import { useAuth } from "../hooks/useAuth";

export function StudioGuard() {
  const { user } = useAuth();
  return canAccessStudio(user?.role) ? <Outlet /> : <Navigate to="/" replace />;
}
