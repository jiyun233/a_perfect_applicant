<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  AlertTriangle,
  Gamepad2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import MachineFormDialog from '@/components/admin/MachineFormDialog.vue'
import MachineStatusDialog from '@/components/admin/MachineStatusDialog.vue'
import { api } from '@/lib/api/client'
import type { Machine } from '@/lib/api/types'
import { formatDateTime } from '@/lib/date'
import { machineStateLabel, machineStateTone } from '@/lib/status'
import { cn } from '@/lib/utils'

const machinesQuery = useQuery({
  queryKey: ['admin-machines'],
  queryFn: () => api.adminMachines(),
  refetchInterval: 20_000,
})

const machines = computed(() => machinesQuery.data.value?.machines ?? [])
const search = ref('')
const filter = ref<'all' | 'active' | 'inactive'>('all')
const formOpen = ref(false)
const statusOpen = ref(false)
const selected = ref<Machine | null>(null)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return machines.value.filter((machine) => {
    if (filter.value === 'active' && !machine.active) return false
    if (filter.value === 'inactive' && machine.active) return false
    if (!term) return true
    return [machine.name, machine.game, machine.code, machine.softwareVersion, machine.location]
      .join(' ')
      .toLowerCase()
      .includes(term)
  })
})

const counts = computed(() => ({
  total: machines.value.length,
  active: machines.value.filter((machine) => machine.active).length,
  playing: machines.value.filter((machine) => machine.status.state === 'playing').length,
  offline: machines.value.filter((machine) => machine.status.state === 'offline').length,
}))

function openCreate() {
  selected.value = null
  formOpen.value = true
}

function openEdit(machine: Machine) {
  selected.value = machine
  formOpen.value = true
}

function openStatus(machine: Machine) {
  selected.value = machine
  statusOpen.value = true
}

function stateLabel(machine: Machine) {
  return machine.active ? machineStateLabel(machine.status.state) : '已停用'
}

function stateTone(machine: Machine) {
  return machine.active ? machineStateTone(machine.status.state) : ('muted' as const)
}
</script>

<template>
  <div class="space-y-5">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">机台</h1>
        <p class="mt-1.5 text-sm text-muted-foreground">维护机台信息、版本与实时状态。</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="machinesQuery.isFetching.value" @click="machinesQuery.refetch()">
          <RefreshCw :class="cn('size-4', machinesQuery.isFetching.value && 'animate-spin')" />
          刷新
        </Button>
        <Button size="sm" @click="openCreate">
          <Plus class="size-4" /> 新增
        </Button>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">总数</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ counts.total }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">启用</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ counts.active }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">游玩中</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ counts.playing }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">离线</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ counts.offline }}</p>
      </Card>
    </div>

    <Card class="overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1 sm:flex">
          <button
            v-for="option in [
              { value: 'all', label: '全部' },
              { value: 'active', label: '启用' },
              { value: 'inactive', label: '停用' },
            ]"
            :key="option.value"
            type="button"
            :aria-pressed="filter === option.value"
            class="min-h-11 rounded-md px-2.5 text-sm font-medium transition-colors sm:min-h-9 sm:text-xs"
            :class="filter === option.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="filter = option.value as 'all' | 'active' | 'inactive'"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="relative w-full sm:max-w-[240px]">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="search" class="pl-9" placeholder="搜索机台或版本" />
        </div>
      </div>

      <div v-if="machinesQuery.isPending.value" class="p-4">
        <Skeleton class="h-56 w-full rounded-lg" />
      </div>
      <div v-else-if="machinesQuery.isError.value" class="flex items-start gap-3 p-4">
        <AlertTriangle class="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p class="text-sm font-medium text-foreground">机台列表加载失败</p>
          <p class="mt-1 text-xs text-muted-foreground">请稍后重试。</p>
          <Button variant="outline" size="sm" class="mt-3" @click="machinesQuery.refetch()">重新加载</Button>
        </div>
      </div>
      <div v-else-if="filtered.length === 0" class="px-4 py-12 text-center">
        <Gamepad2 class="mx-auto size-5 text-muted-foreground" />
        <p class="mt-2 text-sm font-medium text-foreground">没有匹配的机台</p>
      </div>

      <div v-else class="hidden overflow-x-auto md:block">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs text-muted-foreground">
              <th class="px-4 py-2.5 font-medium">机台</th>
              <th class="px-4 py-2.5 font-medium">版本</th>
              <th class="px-4 py-2.5 font-medium">容量</th>
              <th class="px-4 py-2.5 font-medium">状态</th>
              <th class="px-4 py-2.5 font-medium">更新</th>
              <th class="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="machine in filtered" :key="machine.id" class="hover:bg-muted/40">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Gamepad2 class="size-4" />
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-foreground">{{ machine.name }}</p>
                    <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ machine.game }} · {{ machine.location || '未设置位置' }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-foreground">{{ machine.softwareVersion || '—' }}</td>
              <td class="px-4 py-3 text-sm text-muted-foreground number-tabular">{{ machine.capacity }} 人</td>
              <td class="px-4 py-3"><Badge :variant="stateTone(machine)">{{ stateLabel(machine) }}</Badge></td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{{ formatDateTime(machine.status.lastSeenAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" @click="openStatus(machine)">
                    <SlidersHorizontal class="size-4" />状态
                  </Button>
                  <Button variant="ghost" size="sm" @click="openEdit(machine)">
                    <Pencil class="size-4" />编辑
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filtered.length" class="divide-y divide-border md:hidden">
        <div v-for="machine in filtered" :key="machine.id" class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-foreground">{{ machine.name }}</p>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ machine.game }} · {{ machine.softwareVersion || '—' }}</p>
            </div>
            <Badge :variant="stateTone(machine)">{{ stateLabel(machine) }}</Badge>
          </div>
          <div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{{ machine.capacity }} 人</span>
            <span>{{ machine.location || '未设置位置' }}</span>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" @click="openStatus(machine)">维护状态</Button>
            <Button variant="outline" size="sm" @click="openEdit(machine)">编辑信息</Button>
          </div>
        </div>
      </div>

      <div class="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        共 {{ filtered.length }} 台 · 状态每 20 秒同步
      </div>
    </Card>

    <MachineFormDialog v-model:open="formOpen" :machine="selected" @saved="machinesQuery.refetch()" />
    <MachineStatusDialog v-model:open="statusOpen" :machine="selected" @saved="machinesQuery.refetch()" />
  </div>
</template>
