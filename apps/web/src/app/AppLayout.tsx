import { lazy, Suspense, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { PageTransition } from "@/components/ui/PageTransition";
import { useLocation } from "react-router-dom";
import { NavLink, Outlet } from "react-router-dom";
import { LavaNav } from "./LavaNav";
import { BackgroundLines } from "@/components/BackgroundLines";
import { RouteSkeleton } from "./RouteSkeleton";
import { TimerAlerts } from "@/features/time/components/TimerAlerts";
import { TimerBar, TimerChip } from "@/features/time/components/TimerBar";
import { useRunningEntry } from "@/features/time/hooks/useTime";
import { cn } from "@/lib/utils";
import { navItems, navigationFor } from "./nav";
import { prefetchHandlers } from "./route-loaders";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { ProfileLink } from "./ProfileLink";
import { NotificationMenu } from "@/features/notifications/NotificationMenu";
import { useCardTilt } from "@/lib/useCardTilt";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useFocusRest } from "@/features/day/useFocusRest";
import { readMascotPreference } from "@/lib/mascot-preference";

// The mascot is decorative: it loads after first paint, outside the critical path.
const MascotCompanion = lazy(() =>
  import("@/components/MascotCompanion").then((m) => ({
    default: m.MascotCompanion,
  })),
);

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandLogo className="size-10" decorative />
      <span className="hidden whitespace-nowrap font-display text-sm font-bold min-[420px]:inline sm:text-lg">
        VEXA Studio
      </span>
    </span>
  );
}

/** Sidebar en escritorio (lg) y barra inferior en móvil. */
export function AppLayout() {
  const tilt = useCardTilt();
  const { user } = useAuth();
  const resting = useFocusRest(user?.id);
  const mobileItems = navigationFor(user?.role).filter((item) => item.mobile);
  const { pathname } = useLocation();
  const currentPage =
    navItems.find((item) => item.to === pathname)?.label ??
    "Espacio de trabajo";
  const hasTimer = Boolean(useRunningEntry().data);
  const [mascotVisible] = useState(() => !readMascotPreference().sleeping);

  return (
    <div className="integrated-shell min-h-dvh lg:pl-60" {...tilt}>
      <a
        href="#contenido"
        className="sr-only rounded-lg bg-primary-solid px-4 py-2 text-sm font-medium text-primary-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Saltar al contenido
      </a>
      <TimerAlerts />
      <LavaNav />
      <BackgroundLines />

      <header className="integrated-topbar sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <span className="lg:hidden">
          <Brand />
        </span>
        <div className="topbar-context hidden lg:flex">
          <strong>{currentPage}</strong>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <TimerChip />
          <ThemeToggle />
          {user && <NotificationMenu key={user.id} user={user} />}
          <UserMenu />
          <ProfileLink />
        </div>
      </header>

      <main
        id="contenido"
        data-view={pathname === "/" ? "inicio" : pathname.split("/")[1]}
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-6xl px-4 pt-6 outline-none lg:px-8 lg:pb-12 lg:pt-8",
          hasTimer ? "pb-44" : "pb-28",
        )}
      >
        <Suspense fallback={<RouteSkeleton />}>
          <PageTransition key={pathname}>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>

      <TimerBar />
      {mascotVisible && (
        <Suspense fallback={null}>
          <MascotCompanion
            hasTimer={hasTimer}
            visible={mascotVisible}
            resting={resting}
          />
        </Suspense>
      )}

      <nav
        aria-label="Principal móvil"
        className="integrated-mobile-nav fixed inset-x-0 bottom-0 z-20 grid border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{
          gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))`,
        }}
      >
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            {...prefetchHandlers(to)}
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
