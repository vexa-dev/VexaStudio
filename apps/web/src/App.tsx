import { lazy, Suspense, useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { routeLoaders } from "@/app/route-loaders";
import { AppShellSkeleton, CenteredSkeleton } from "@/app/RouteSkeleton";
import { StudioGuard } from "@/features/auth/components/StudioGuard";
import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { navItems } from "@/app/nav";

// Cada pantalla se carga al entrar en ella: el arranque no descarga el tablero ni el arrastre.
const AppLayout = lazy(() =>
  routeLoaders.layout().then((m) => ({ default: m.AppLayout })),
);
const LoginPage = lazy(routeLoaders.login);
const ResetPasswordPage = lazy(routeLoaders.reset);
const ProfilePage = lazy(routeLoaders.profile);
const DashboardPage = lazy(routeLoaders.dashboard);
const ExpensesPage = lazy(routeLoaders.expenses);
const ProjectsPage = lazy(routeLoaders.projects);
const ActivityPage = lazy(routeLoaders.activity);
const BoardPage = lazy(routeLoaders.board);
const TasksPage = lazy(routeLoaders.tasks);
const TeamPage = lazy(routeLoaders.team);
const TimePage = lazy(routeLoaders.time);
const MyDayPage = lazy(routeLoaders.day);

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
          <Suspense fallback={<CenteredSkeleton />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route
        path="/restablecer"
        element={
          <Suspense fallback={<CenteredSkeleton />}>
            <ResetPasswordPage />
          </Suspense>
        }
      />
      <Route element={<AuthGuard />}>
        <Route
          element={
            <Suspense fallback={<AppShellSkeleton />}>
              <AppLayout />
            </Suspense>
          }
        >
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
