/** Retraso artificial de 150–300 ms para poder probar los estados de carga. */
export function delay<T>(value: T): Promise<T> {
  const ms = 150 + Math.random() * 150
  // Copia profunda: quien consume no debe poder mutar la base simulada.
  const copy = structuredClone(value)
  return new Promise((resolve) => setTimeout(() => resolve(copy), ms))
}

/**
 * Servicio aún sin implementar en el mock (llega en F2–F4). Falla con un mensaje claro
 * al usar cualquiera de sus métodos, en vez de un `undefined is not a function`.
 */
export function notImplemented<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, method) {
      if (typeof method !== 'string' || method === 'then') return undefined
      return () => Promise.reject(new Error(`${name}.${method} aún no está implementado en el mock`))
    },
  })
}

/** Método de escritura aún sin implementar en el mock (llega en su bloque). */
export function pending(name: string): () => Promise<never> {
  return () => Promise.reject(new Error(`${name} aún no está implementado en el mock`))
}

/** Mensaje de lo que solo existe con la conexión a Supabase (contraseña, segundo paso, sesiones). */
export const SUPABASE_ONLY_MESSAGE = 'Disponible solo con la conexión a Supabase.'

/** Método que el mock no puede simular: falla con un aviso claro y en español. */
export function supabaseOnly(): Promise<never> {
  return Promise.reject(new Error(SUPABASE_ONLY_MESSAGE))
}
