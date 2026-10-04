/**
 * Fuente de datos activa. Es el único lugar donde la interfaz decide si habla con el mock o con
 * Supabase; el resto del código pregunta aquí. `mock` es el valor por defecto.
 */
export type DataSource = "mock" | "supabase";

export function getDataSource(): string {
  return import.meta.env.VITE_DATA_SOURCE ?? "mock";
}

export function isSupabaseSource(): boolean {
  return getDataSource() === "supabase";
}
