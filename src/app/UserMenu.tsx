import { Check, FolderKanban, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLoginProfiles } from '@/features/auth/hooks/useLoginProfiles'
import { areaLabel } from '@/lib/labels'

const itemClass = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2'

/** Menú del usuario: cambio rápido de socio (para probar permisos), perfil y cierre de sesión. */
export function UserMenu() {
  const { user, signIn, signOut } = useAuth()
  const { data: profiles } = useLoginProfiles()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded-full p-0.5 hover:bg-surface-2"
      >
        <Avatar name={user.name} size="sm" />
      </button>

      {open ? (
        <div
          role="menu"
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
                setOpen(false)
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
          <Link role="menuitem" to="/perfil" className={itemClass} onClick={() => setOpen(false)}>
            <UserRound className="size-4" aria-hidden="true" /> Mi perfil
          </Link>
          <Link
            role="menuitem"
            to="/proyectos"
            className={`${itemClass} lg:hidden`}
            onClick={() => setOpen(false)}
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
