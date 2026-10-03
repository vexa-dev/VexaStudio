import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'

export function useLoginProfiles() {
  return useQuery({
    queryKey: ['auth', 'login-profiles'],
    queryFn: () => services.auth.listLoginProfiles(),
  })
}
