import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { areaLabel, roleLabel } from '@/lib/labels'
import { stagger } from '@/lib/utils'
import { useAuth } from '../hooks/useAuth'
import { useLoginProfiles } from '../hooks/useLoginProfiles'

const LAST_USER_KEY = 'vexa-studio.last-user'

function readLastUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY)
  } catch {
    return null
  }
}

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const { data, isLoading, isError, refetch } = useLoginProfiles()
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lastUserId] = useState(readLastUser)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  // El último usuario va primero: volver a entrar es un toque.
  const profiles = data ? [...data].sort((a, b) => Number(b.id === lastUserId) - Number(a.id === lastUserId)) : data

  const choose = async (userId: string) => {
    setPendingId(userId)
    try {
      await signIn(userId)
      try {
        localStorage.setItem(LAST_USER_KEY, userId)
      } catch {
        // Sin localStorage no se recuerda el último usuario.
      }
      navigate(from, { replace: true })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="enter flex flex-col gap-4">
        <img src="/vexa-mark.svg" alt="" className="size-14" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold leading-tight">Bienvenido a VEXA Studio</h1>
          <p className="text-sm text-muted">
            Elige tu usuario para entrar. En el modo de pruebas no se pide contraseña.
          </p>
        </div>
      </header>

      {isError ? (
        <ErrorState message="No se pudo cargar la lista de socios." onRetry={() => refetch()} />
      ) : (
        <ul className="flex flex-col gap-3">
          {isLoading
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[76px]" />
                </li>
              ))
            : profiles?.map((profile, index) => (
                <li key={profile.id} className="enter" style={stagger(index + 1)}>
                  <button
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => choose(profile.id)}
                    className="flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-card hover:border-primary disabled:opacity-60"
                  >
                    <Avatar name={profile.name} size="lg" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{profile.name}</span>
                      <span className="text-sm text-muted">{areaLabel[profile.area]}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Badge tone={profile.role === 'admin' ? 'primary' : 'neutral'}>
                        {roleLabel[profile.role]}
                      </Badge>
                      {profile.id === lastUserId ? <span className="text-xs text-muted">Último acceso</span> : null}
                    </span>
                  </button>
                </li>
              ))}
        </ul>
      )}
    </main>
  )
}
