import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { navItems } from './nav'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/vexa-mark.svg" alt="" className="size-8" />
      <span className="font-display text-lg font-bold">VEXA Studio</span>
    </span>
  )
}

/** Sidebar en escritorio (lg) y barra inferior en móvil. */
export function AppLayout() {
  return (
    <div className="min-h-screen lg:pl-60">
      <a
        href="#contenido"
        className="sr-only rounded-lg bg-primary-solid px-4 py-2 text-sm font-medium text-primary-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Saltar al contenido
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r border-border bg-surface p-4 lg:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive ? 'bg-primary-soft text-primary-text' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur">
        <span className="lg:hidden">
          <Brand />
        </span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 outline-none lg:pb-10">
        <Outlet />
      </main>

      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {navItems
          .filter((item) => item.mobile)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium',
                  isActive
                    ? 'font-semibold text-primary-text before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-primary-solid'
                    : 'text-muted',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
      </nav>
    </div>
  )
}
