import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/services/supabase/database.types";

/**
 * Cliente tipado de Supabase. Solo usa la URL y la clave pública (anon/publishable): nunca una
 * clave `service_role`. Las entradas del registro de actividad dependen de tres cabeceras que este
 * cliente agrega a cada llamada REST (ver docs/arquitectura.md):
 *   x-request-id  agrupa las entradas de una misma operación
 *   x-client      `web/<versión>`
 *   x-client-at   hora del reloj del cliente (informativa; la hora oficial es la del servidor)
 */
export type VexaSupabase = SupabaseClient<Database>;

export const REQUEST_ID_HEADER = "x-request-id";
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";

export function newRequestId(): string {
  return `r-${crypto.randomUUID()}`;
}

/** Envuelve `fetch`: las llamadas REST llevan las cabeceras de actividad; las de auth, no. */
export function withActivityHeaders(base: typeof fetch): typeof fetch {
  return (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!url.includes("/rest/v1/")) return base(input, init);
    const headers = new Headers(init?.headers);
    // Una operación de varias llamadas fija su propio x-request-id; si no, cada llamada es una.
    if (!headers.has(REQUEST_ID_HEADER))
      headers.set(REQUEST_ID_HEADER, newRequestId());
    headers.set("x-client", `web/${APP_VERSION}`);
    headers.set("x-client-at", new Date().toISOString());
    return base(input, { ...init, headers });
  };
}

export interface ClientOptions {
  /** `false` en pruebas de Node: la sesión vive solo en memoria. */
  persistSession?: boolean;
}

export function createSupabaseClient(
  url: string,
  key: string,
  options: ClientOptions = {},
): VexaSupabase {
  const persist = options.persistSession ?? true;
  return createClient<Database>(url, key, {
    // Heartbeat in a same-origin worker: background tabs throttle timers and would drop presence.
    // A hosted file (not the default Blob URL) keeps CSP `worker-src 'self'` intact.
    realtime: { worker: true, workerUrl: "/realtime-heartbeat.worker.js" },
    global: { fetch: withActivityHeaders((...args) => fetch(...args)) },
    auth: {
      persistSession: persist,
      autoRefreshToken: persist,
      detectSessionInUrl: false,
    },
  });
}

let shared: VexaSupabase | null = null;

/** Cliente de la aplicación. Falla con un mensaje claro si falta la configuración. */
export function getSupabase(): VexaSupabase {
  if (shared) return shared;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Falta configurar Supabase: define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
    );
  shared = createSupabaseClient(url, key);
  return shared;
}
