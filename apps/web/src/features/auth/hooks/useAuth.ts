import { createContext, useContext } from 'react'
import type { Profile } from '@vexa/domain/types'

interface AuthContextValue {
  /** Usuario de la sesión; `null` si no hay sesión. */
  user: Profile | null
  isLoading: boolean
  signIn: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
