import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { Profile } from '@vexa/domain/types'
import { services } from '@/services'
import type { CredentialsAuthService } from '@/services/supabase/auth'
import { isSupabaseSource } from '@/services/supabase/data-source'
import { AuthContext } from './hooks/useAuth'

const SESSION_KEY = ['auth', 'session']

/** Con Supabase el acceso es por correo y contraseña; con el mock, por perfil. */
function credentialsAuth(): CredentialsAuthService | null {
  return isSupabaseSource() && 'signInWithPassword' in services.auth
    ? (services.auth as CredentialsAuthService)
    : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => services.auth.getSession(),
  })

  // Al cambiar de usuario, todo lo cacheado (permisos, "mis tareas"…) deja de ser válido.
  // `resetQueries` vacía la caché y vuelve a pedir lo que está en pantalla; `clear()` dejaría
  // a los componentes montados mirando consultas ya descartadas.
  const reset = useCallback(
    async (session: Profile | null) => {
      queryClient.setQueryData(SESSION_KEY, session)
      await queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== 'auth' })
    },
    [queryClient],
  )

  // Sesión cerrada o iniciada en otra pestaña, o refresco de token fallido.
  useEffect(
    () =>
      credentialsAuth()?.onSessionChange((profile) => {
        const current = queryClient.getQueryData<Profile | null>(SESSION_KEY)
        if ((current?.id ?? null) !== (profile?.id ?? null)) void reset(profile)
      }),
    [queryClient, reset],
  )

  const value = useMemo(() => {
    const credentials = credentialsAuth()
    return {
      user: data ?? null,
      isLoading,
      signIn: async (userId: string) => reset(await services.auth.signIn(userId)),
      supportsPassword: credentials !== null,
      signInWithPassword: async (email: string, password: string) => {
        if (!credentials) throw new Error('El acceso con correo y contraseña no está disponible')
        await reset(await credentials.signInWithPassword(email, password))
      },
      signOut: async () => {
        await services.auth.signOut()
        await reset(null)
      },
    }
  }, [data, isLoading, reset])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
