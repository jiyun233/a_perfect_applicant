import { type Ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { api } from '@/lib/api/client'
import type { ScheduleCell } from '@/lib/api/types'

export function useScheduleQuery(date: Ref<string>) {
  const query = useQuery({
    queryKey: computed(() => ['schedule', date.value]),
    queryFn: () => api.getSchedule(date.value),
    enabled: computed(() => Boolean(date.value)),
    refetchInterval: 30_000,
    staleTime: 8_000,
    retry: 1,
  })

  const cellsByMachine = computed(() => {
    const map = new Map<string, Map<string, ScheduleCell>>()
    for (const cell of query.data.value?.cells ?? []) {
      let slots = map.get(cell.machineId)
      if (!slots) {
        slots = new Map()
        map.set(cell.machineId, slots)
      }
      slots.set(cell.slotStart, cell)
    }
    return map
  })

  return { ...query, cellsByMachine }
}
