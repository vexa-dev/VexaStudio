import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: () => services.projects.list() })
}
