import { createContext, useContext } from 'react'
import type { Profile } from '@vexa/domain/types'

interface AuthContextValue {
  /** Usuario de la sesión; `null` si no hay sesión. */
  user: Profile | null
  isLoading: boolean
  /** Acceso simulado: elegir un perfil (solo mock). */
  signIn: (userId: string) => Promise<void>
  /** `true` cuando la fuente de datos autentica con correo y contraseña (Supabase). */
  supportsPassword: boolean
  /** Resolves `"mfa"` when the password was accepted but the account still needs its second step. */
  signInWithPassword: (email: string, password: string) => Promise<'done' | 'mfa'>
  /** The session needs a verification code (after the password, or after a reload). */
  mfaPending: boolean
  /** Completes the second step with the 6-digit code and signs the person in. */
  verifyMfa: (code: string) => Promise<void>
  /** Abandons the second step and discards the half-open session. */
  cancelMfa: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
