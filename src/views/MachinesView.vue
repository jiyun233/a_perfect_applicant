<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertTriangle,
  Clock3,
  Gamepad2,
  MapPin,
  Music2,
  RefreshCw,
  Search,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useMachinesQuery } from '@/composables/useMachines'
import type { Machine, MachineState } from '@/lib/api/types'
import { formatDateTime, relativeTime } from '@/lib/date'
import { machineStateLabel, machineStateTone } from '@/lib/status'
import { cn } from '@/lib/utils'

const machinesQuery = useMachinesQuery()
const machines = computed(() => machinesQuery.data.value?.machines ?? [])
const isLoading = computed(() => machinesQuery.isPending.value && !machines.value.length)
const isRefreshing = computed(() => machinesQuery.isFetching.value)
const lastUpdated = computed(() =>
  machinesQuery.dataUpdatedAt.value ? new Date(machinesQuery.dataUpdatedAt.value) : null,
)

const search = ref('')
const stateFilter = ref<'all' | MachineState>('all')

const filters: { value: 'all' | MachineState; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'playing', label: '游玩中' },
  { value: 'idle', label: '空闲' },
  { value: 'offline', label: '离线' },
]

const stats = computed(() => ({
  total: machines.value.length,
  online: machines.value.filter((machine) => machine.active && machine.status.state !== 'offline').length,
  playing: machines.value.filter((machine) => machine.status.state === 'playing').length,
  offline: machines.value.filter((machine) => machine.status.state === 'offline').length,
  players: machines.value.reduce((sum, machine) => sum + machine.status.currentPlayers, 0),
}))

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return machines.value
    .filter((machine) => {
      if (stateFilter.value !== 'all' && machine.status.state !== stateFilter.value) return false
      if (!term) return true
      return [machine.name, machine.game, machine.code, machine.location, machine.softwareVersion]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
    .sort((a, b) => {
      const rank: Record<MachineState, number> = { playing: 0, idle: 1, offline: 2 }
      if (a.active !== b.active) return a.active ? -1 : 1
      return rank[a.status.state] - rank[b.status.state] || a.sortOrder - b.sortOrder
    })
})

function stateLabel(machine: Machine) {
  if (!machine.active) return '已停用'
  return machineStateLabel(machine.status.state)
}

function stateTone(machine: Machine) {
  if (!machine.active) return 'muted' as const
  return machineStateTone(machine.status.state)
}

function isStale(machine: Machine) {
  const last = new Date(machine.status.lastSeenAt).getTime()
  return Number.isFinite(last) && Date.now() - last > 30 * 60 * 1000
}

function refresh() {
  machinesQuery.refetch()
}
</script>

<template>
  <div class="space-y-5">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">机台状态</h1>
        <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          查看全部机台的版本、在线状态与当前游玩情况。页面每 15 秒自动更新。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">
          {{ lastUpdated ? `${relativeTime(lastUpdated)}更新` : '等待数据' }}
        </span>
        <Button variant="outline" size="sm" :disabled="isRefreshing" @click="refresh">
          <RefreshCw :class="cn('size-4', isRefreshing && 'animate-spin')" />
          刷新
        </Button>
      </div>
    </section>

    <div v-if="isLoading" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
    </div>
    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">机台总数</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ stats.total }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">在线</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ stats.online }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">游玩中</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">
          {{ stats.playing }}
          <span class="ml-1 text-xs font-normal text-muted-foreground">{{ stats.players }} 人</span>
        </p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-muted-foreground">离线</p>
        <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ stats.offline }}</p>
      </Card>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="h-8 shrink-0 rounded-md px-3 text-xs font-medium transition-colors"
          :class="
            stateFilter === filter.value
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="stateFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
      <div class="relative w-full sm:max-w-[240px]">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" class="pl-9" placeholder="搜索机台或版本" aria-label="搜索机台" />
      </div>
    </div>

    <div v-if="machinesQuery.isError.value" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
      <div class="flex items-start gap-3">
        <AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p class="text-sm font-medium text-foreground">机台数据加载失败</p>
          <p class="mt-1 text-sm text-muted-foreground">请稍后重试。</p>
          <Button variant="outline" size="sm" class="mt-3" @click="refresh">
            <RefreshCw class="size-4" />重新加载
          </Button>
        </div>
      </div>
    </div>

    <div v-else-if="isLoading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="i in 6" :key="i" class="h-52 rounded-xl" />
    </div>

    <div v-else-if="filtered.length === 0" class="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <Gamepad2 class="mx-auto size-6 text-muted-foreground" />
      <p class="mt-2 text-sm font-medium text-foreground">没有找到机台</p>
      <p class="mt-1 text-xs text-muted-foreground">尝试更换搜索词或筛选条件。</p>
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="machine in filtered"
        :key="machine.id"
        class="p-4"
        :class="{ 'opacity-60': !machine.active }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <h2 class="truncate text-base font-semibold text-foreground">{{ machine.name }}</h2>
              <Badge :variant="stateTone(machine)">{{ stateLabel(machine) }}</Badge>
            </div>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ machine.game }}</p>
          </div>
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Gamepad2 class="size-4" />
          </span>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">版本</dt>
            <dd class="mt-0.5 truncate font-medium text-foreground">{{ machine.softwareVersion || '未设置' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">人数</dt>
            <dd class="mt-0.5 flex items-center gap-1 font-medium text-foreground number-tabular">
              <Users class="size-3.5 text-muted-foreground" />
              {{ machine.status.currentPlayers }}/{{ machine.capacity }}
            </dd>
          </div>
          <div class="col-span-2">
            <dt class="text-xs text-muted-foreground">位置</dt>
            <dd class="mt-0.5 flex items-center gap-1 truncate text-foreground">
              <MapPin class="size-3.5 shrink-0 text-muted-foreground" />
              {{ machine.location || '未设置' }}
            </dd>
          </div>
        </dl>

        <div class="mt-3 rounded-lg bg-muted/60 px-3 py-2.5">
          <template v-if="machine.status.state === 'playing' && machine.active">
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Music2 class="size-3.5" />
              正在游玩
            </p>
            <p class="mt-0.5 truncate text-sm text-foreground">
              {{ machine.status.currentSong || '未填写曲目' }}
              <span v-if="machine.status.currentChart" class="text-muted-foreground">· {{ machine.status.currentChart }}</span>
            </p>
          </template>
          <template v-else-if="machine.status.state === 'offline'">
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <WifiOff class="size-3.5" />
              机台离线
            </p>
            <p class="mt-0.5 text-sm text-muted-foreground">暂时无法游玩</p>
          </template>
          <template v-else>
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wifi class="size-3.5" />
              空闲
            </p>
            <p class="mt-0.5 text-sm text-muted-foreground">可以前往实验室游玩或预约</p>
          </template>
        </div>

        <div class="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="flex items-center gap-1" :class="isStale(machine) && 'text-warning'">
            <Clock3 class="size-3.5" />
            {{ relativeTime(machine.status.lastSeenAt) }}更新
          </span>
          <RouterLink
            v-if="machine.active && machine.status.state !== 'offline'"
            to="/booking"
            class="font-medium text-primary"
          >
            去预约
          </RouterLink>
        </div>
      </Card>
    </div>

    <p class="flex items-center justify-between border-t border-border pt-4 text-[11px] text-muted-foreground">
      <span>共 {{ machines.length }} 台</span>
      <span>{{ lastUpdated ? formatDateTime(lastUpdated) : '—' }}</span>
    </p>
  </div>
</template>
