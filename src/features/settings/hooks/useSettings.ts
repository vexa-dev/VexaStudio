import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => services.settings.get() })
}
