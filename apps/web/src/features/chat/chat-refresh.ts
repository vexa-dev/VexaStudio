/** Reused signatures are at most five minutes old; renew with five minutes grace.
 * Focus refresh also recovers tabs suspended beyond the one-hour URL lifetime.
 */
export function chatMediaRefresh(supabase: boolean) {
  return supabase
    ? {
        refetchInterval: 50 * 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: "always" as const,
      }
    : {};
}
