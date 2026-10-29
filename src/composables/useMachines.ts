import { useQuery } from '@tanstack/vue-query'
import { api } from '@/lib/api/client'

export function useMachinesQuery() {
  return useQuery({
    queryKey: ['machines'],
    queryFn: () => api.getMachines(),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })
}
