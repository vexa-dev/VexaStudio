import { createMockServices } from './mock'
import type { Services } from './types'

function createServices(): Services {
  const source = import.meta.env.VITE_DATA_SOURCE ?? 'mock'
  if (source === 'mock') return createMockServices()
  throw new Error(
    `VITE_DATA_SOURCE="${source}" no está disponible en esta etapa. Usa "mock" hasta la integración con Supabase.`,
  )
}

export const services: Services = createServices()
export type * from './types'
