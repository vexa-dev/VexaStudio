import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { areaLabel, roleLabel } from '@/lib/labels'
import { useAuth } from '../hooks/useAuth'
import { useLoginProfiles } from '../hooks/useLoginProfiles'

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const { data: profiles, isLoading, isError, refetch } = useLoginProfiles()
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  const choose = async (userId: string) => {
    setPendingId(userId)
    try {
      await signIn(userId)
      navigate(from, { replace: true })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <img src="/vexa-mark.svg" alt="" className="size-16" />
        <h1 className="text-2xl font-bold">VEXA Studio</h1>
        <p className="text-sm text-muted">
          Elige tu usuario para continuar. Modo de pruebas: no requiere contraseña.
        </p>
      </header>

      {isError ? (
        <ErrorState message="No se pudo cargar la lista de socios." onRetry={() => refetch()} />
      ) : (
        <ul className="flex flex-col gap-3">
          {isLoading
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[72px]" />
                </li>
              ))
            : profiles?.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => choose(profile.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition motion-reduce:transition-none hover:border-primary disabled:opacity-60"
                  >
                    <Avatar name={profile.name} size="lg" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{profile.name}</span>
                      <span className="text-sm text-muted">{areaLabel[profile.area]}</span>
                    </span>
                    <Badge tone={profile.role === 'admin' ? 'primary' : 'neutral'}>
                      {roleLabel[profile.role]}
                    </Badge>
                  </button>
                </li>
              ))}
        </ul>
      )}
    </main>
  )
}
