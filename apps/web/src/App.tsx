import { lazy, Suspense, useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "@/app/AppLayout";
import { StudioGuard } from "@/features/auth/components/StudioGuard";
import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { navItems } from "@/app/nav";

// Cada pantalla se carga al entrar en ella: el arranque no descarga el tablero ni el arrastre.
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const ResetPasswordPage = lazy(
  () => import("@/features/auth/pages/ResetPasswordPage"),
);
const ProfilePage = lazy(() => import("@/features/auth/pages/ProfilePage"));
const DashboardPage = lazy(
  () => import("@/features/dashboard/pages/DashboardPage"),
);
const ExpensesPage = lazy(
  () => import("@/features/expenses/pages/ExpensesPage"),
);
const ProjectsPage = lazy(
  () => import("@/features/projects/pages/ProjectsPage"),
);
const ActivityPage = lazy(
  () => import("@/features/activity/pages/ActivityPage"),
);
const BoardPage = lazy(() => import("@/features/tasks/pages/BoardPage"));
const TasksPage = lazy(() => import("@/features/tasks/pages/TasksPage"));
const TeamPage = lazy(() => import("@/features/team/pages/TeamPage"));
const TimePage = lazy(() => import("@/features/time/pages/TimePage"));

const MyDayPage = lazy(() => import("@/features/day/MyDayPage"));

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title =
      navItems.find((item) => item.to === pathname)?.label ||
      (pathname.startsWith("/proyectos/")
        ? "Tablero"
        : pathname === "/login"
          ? "Acceso"
          : pathname === "/restablecer"
            ? "Restablecer contraseña"
          : pathname === "/perfil"
            ? "Perfil"
            : "Página no encontrada");
    document.title = `${title} · VEXA Studio`;
    document.getElementById("contenido")?.focus({ preventScroll: true });
  }, [pathname]);
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
      <Route
        path="/restablecer"
        element={
          <Suspense fallback={null}>
            <ResetPasswordPage />
          </Suspense>
        }
      />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="mi-dia" element={<MyDayPage />} />
          <Route path="proyectos" element={<ProjectsPage />} />
          <Route path="proyectos/:projectId" element={<BoardPage />} />
          <Route path="tareas" element={<TasksPage />} />
          <Route path="horas" element={<TimePage />} />
          <Route element={<StudioGuard />}>
            <Route path="gastos" element={<ExpensesPage />} />
            <Route path="equipo" element={<TeamPage />} />
            <Route path="actividad" element={<ActivityPage />} />
          </Route>
          <Route path="perfil" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <main className="mx-auto max-w-xl px-6 py-20">
            <h1 className="text-3xl">Fuera de órbita.</h1>
            <p className="my-6 text-muted">
              Esta página no forma parte del estudio.
            </p>
            <Link className="text-primary-text" to="/">
              Volver al inicio
            </Link>
          </main>
        }
      />
    </Routes>
  );
}
