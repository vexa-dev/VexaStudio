import { getSupabase, newRequestId } from "@/lib/supabase";

/**
 * Avisa cuando se agrega una entrada al registro de actividad. Realtime aplica RLS por suscriptor:
 * cada persona solo recibe lo que podría leer. Devuelve la función que cancela la suscripción.
 */
export function subscribeToAuditInserts(onInsert: () => void): () => void {
  const client = getSupabase();
  const channel = client
    .channel(`activity-${newRequestId()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "audit_log" },
      () => onInsert(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/**
 * Avisa cuando llega una notificación nueva para la persona. El filtro por `user_id` reduce el
 * tráfico y Realtime aplica además el RLS de lectura. Devuelve la función que cancela la suscripción.
 */
export function subscribeToNotifications(
  userId: string,
  onInsert: () => void,
): () => void {
  const client = getSupabase();
  const channel = client
    .channel(`notifications-${newRequestId()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => onInsert(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
