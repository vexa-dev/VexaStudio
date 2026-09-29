import { Check, FolderKanban, LogOut, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLoginProfiles } from '@/features/auth/hooks/useLoginProfiles'
import { areaLabel } from '@/lib/labels'

const itemClass = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2'
const ITEM_SELECTOR = '[role^="menuitem"]'

/** Menú del usuario: cambio rápido de socio (para probar permisos), perfil y cierre de sesión. */
export function UserMenu() {
  const { user, signIn, signOut } = useAuth()
  const { data: profiles } = useLoginProfiles()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  /** Cierra el menú; con `restoreFocus` el foco vuelve al botón (teclado), no al hacer clic fuera. */
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    // Al abrir, el foco entra al menú: al usuario actual (o al primer ítem).
    const items = menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR)
    const current = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    ;(current ?? items?.[0])?.focus()

    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, close])

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    if (e.key === 'Tab') {
      // El menú no atrapa el foco: Tab lo cierra y sigue el orden normal de la página.
      setOpen(false)
      return
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    const move = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[e.key]
    if (move === undefined || items.length === 0) return
    e.preventDefault()
    items[(move + items.length) % items.length].focus()
  }

  if (!user) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
      >
        <Avatar name={user.name} size="sm" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Menú de usuario"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">
            Cambiar de usuario
          </p>
          {profiles?.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === user.id}
              className={itemClass}
              onClick={async () => {
                await signIn(p.id)
                close(true)
              }}
            >
              <Avatar name={p.name} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted">{areaLabel[p.area]}</span>
              </span>
              {p.id === user.id ? <Check className="size-4 text-primary-text" aria-hidden="true" /> : null}
            </button>
          ))}
          <hr className="my-2 border-border" />
          <Link role="menuitem" to="/perfil" className={itemClass} onClick={() => close(false)}>
            <UserRound className="size-4" aria-hidden="true" /> Mi perfil
          </Link>
          <Link
            role="menuitem"
            to="/proyectos"
            className={`${itemClass} lg:hidden`}
            onClick={() => close(false)}
          >
            <FolderKanban className="size-4" aria-hidden="true" /> Proyectos
          </Link>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  )
}
