import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'

export function useMembers() {
  return useQuery({ queryKey: ['members'], queryFn: () => services.members.list() })
}
