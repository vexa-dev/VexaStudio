/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'supabase'
  readonly VITE_SUPABASE_URL?: string
  /** Clave pública (anon/publishable). Nunca la `service_role`. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
