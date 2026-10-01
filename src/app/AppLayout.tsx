import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { TimerBar, TimerChip } from "@/features/time/components/TimerBar";
import { useRunningEntry } from "@/features/time/hooks/useTime";
import { areaLabel, roleLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { navItems } from "./nav";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/vexa-mark.svg" alt="" className="size-8" />
      <span className="font-display text-lg font-bold">VEXA Studio</span>
    </span>
  );
}

/** Sidebar en escritorio (lg) y barra inferior en móvil. */
export function AppLayout() {
  const { user } = useAuth();
  const hasTimer = Boolean(useRunningEntry().data);
  return (
    <div className="integrated-shell min-h-dvh lg:pl-60">
      <a
        href="#contenido"
        className="sr-only rounded-lg bg-primary-solid px-4 py-2 text-sm font-medium text-primary-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Saltar al contenido
      </a>
      <aside className="integrated-sidebar fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r border-border bg-surface p-4 lg:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-primary-soft font-semibold text-primary-text"
                    : "font-medium text-muted hover:bg-surface-2 hover:text-fg",
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink
          to="/observatorio/"
          className="rounded-lg border border-border px-3 py-2 text-sm text-primary-text"
        >
          Explorar demo Observatorio
        </NavLink>
        {user ? (
          <NavLink
            to="/perfil"
            className="mt-auto flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-surface-2"
          >
            <Avatar name={user.name} size="sm" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted">
                {roleLabel[user.role]} · {areaLabel[user.area]}
              </span>
            </span>
          </NavLink>
        ) : null}
      </aside>

      <header className="integrated-topbar sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <span className="lg:hidden">
          <Brand />
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-2 text-xs text-muted">Demo local</span>
          <TimerChip />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-6xl px-4 pt-6 outline-none lg:px-8 lg:pb-12 lg:pt-8",
          hasTimer ? "pb-44" : "pb-28",
        )}
      >
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Outlet />
        </Suspense>
        <NavLink
          to="/observatorio/"
          className="mt-8 inline-flex min-h-11 items-center text-sm text-primary-text lg:hidden"
        >
          Explorar demo Observatorio
        </NavLink>
      </main>

      <TimerBar />

      <nav
        aria-label="Principal móvil"
        className="integrated-mobile-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {navItems
          .filter((item) => item.mobile)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors duration-150",
                  isActive
                    ? "font-semibold text-primary-text before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-primary-solid"
                    : "text-muted",
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
