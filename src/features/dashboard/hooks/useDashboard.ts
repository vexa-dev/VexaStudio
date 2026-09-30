import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'

export function useMonthlySummary(month: string) {
  return useQuery({ queryKey: ['dashboard', 'monthly', month], queryFn: () => services.dashboard.getMonthlySummary(month) })
}

export function usePoints() {
  return useQuery({ queryKey: ['dashboard', 'points'], queryFn: () => services.dashboard.getPoints() })
}
