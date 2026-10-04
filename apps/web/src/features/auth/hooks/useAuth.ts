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
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
