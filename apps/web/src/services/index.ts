import { createMockServices } from './mock'
import { createSupabaseServices } from './supabase'
import { getDataSource } from './supabase/data-source'
import type { Services } from '@vexa/services'

/** `VITE_DATA_SOURCE`: `mock` (por defecto) o `supabase`. */
function createServices(): Services {
  const source = getDataSource()
  if (source === 'mock') return createMockServices()
  if (source === 'supabase') return createSupabaseServices()
  throw new Error(`VITE_DATA_SOURCE="${source}" no es válido. Usa "mock" o "supabase".`)
}

export const services: Services = createServices()
export type * from '@vexa/services'
