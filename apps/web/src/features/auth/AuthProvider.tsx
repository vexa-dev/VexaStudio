import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { MfaChallenge, Profile } from '@vexa/domain/types'
import { services } from '@/services'
import { MfaRequiredError, type CredentialsAuthService } from '@/services/supabase/auth'
import { isSupabaseSource } from '@/services/supabase/data-source'
import { AuthContext } from './hooks/useAuth'

const SESSION_KEY = ['auth', 'session']
const MFA_KEY = ['auth', 'mfa']
const NO_MFA: MfaChallenge = { required: false }

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

  // Un reinicio de página con el segundo paso pendiente no entrega perfil: se pregunta aparte.
  // Solo aplica al acceso por contraseña; el mock nunca lo exige.
  const mfaEnabled = credentialsAuth() !== null && !isLoading && !data
  const mfa = useQuery({
    queryKey: MFA_KEY,
    queryFn: () => services.auth.getMfaChallenge(),
    enabled: mfaEnabled,
    staleTime: Infinity,
    retry: false,
  })
  const challenge = mfa.data ?? NO_MFA

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
      isLoading: isLoading || (mfaEnabled && mfa.isPending),
      mfaPending: !data && challenge.required,
      signIn: async (userId: string) => reset(await services.auth.signIn(userId)),
      supportsPassword: credentials !== null,
      signInWithPassword: async (email: string, password: string) => {
        if (!credentials) throw new Error('El acceso con correo y contraseña no está disponible')
        try {
          await reset(await credentials.signInWithPassword(email, password))
          queryClient.setQueryData(MFA_KEY, NO_MFA)
          return 'done' as const
        } catch (reason) {
          if (!(reason instanceof MfaRequiredError)) throw reason
          queryClient.setQueryData<MfaChallenge>(MFA_KEY, {
            required: true,
            ...(reason.factorId ? { factorId: reason.factorId } : {}),
          })
          return 'mfa' as const
        }
      },
      verifyMfa: async (code: string) => {
        // Sin factorId en el aviso se consulta de nuevo: el factor lo conoce el servicio.
        const factorId = challenge.factorId ?? (await services.auth.getMfaChallenge()).factorId
        if (!factorId) throw new Error('No encontramos tu verificación en dos pasos. Vuelve a iniciar sesión.')
        const profile = await services.auth.verifyMfaLogin(factorId, code)
        queryClient.setQueryData(MFA_KEY, NO_MFA)
        await reset(profile)
      },
      cancelMfa: async () => {
        await services.auth.signOut()
        queryClient.setQueryData(MFA_KEY, NO_MFA)
        await reset(null)
      },
      signOut: async () => {
        await services.auth.signOut()
        queryClient.setQueryData(MFA_KEY, NO_MFA)
        await reset(null)
      },
    }
  }, [data, isLoading, reset, queryClient, mfaEnabled, mfa.isPending, challenge])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
