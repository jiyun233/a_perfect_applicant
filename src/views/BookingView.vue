<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gamepad2,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
  Wifi,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'vue-sonner'
import BookingDialog from '@/components/booking/BookingDialog.vue'
import ReservationLookupPanel from '@/components/booking/ReservationLookupPanel.vue'
import { useScheduleQuery } from '@/composables/useSchedule'
import type { Machine, PublicReservationEntry } from '@/lib/api/types'
import {
  addDaysKey,
  formatDateLong,
  formatMonthDay,
  formatWeekday,
  isDateKeyToday,
  todayKey,
} from '@/lib/date'
import { machineStateLabel, machineStateTone } from '@/lib/status'
import { cn } from '@/lib/utils'

const route = useRoute()
const router = useRouter()

const selectedDate = ref(
  typeof route.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date)
    ? route.query.date
    : todayKey(),
)
const scheduleQuery = useScheduleQuery(selectedDate)
const schedule = computed(() => scheduleQuery.data.value ?? null)
const isInitialLoading = computed(() => scheduleQuery.isPending.value && !schedule.value)
const isRefreshing = computed(() => scheduleQuery.isFetching.value)

const days = computed(() => {
  const base = schedule.value?.today ?? todayKey()
  const count = schedule.value?.bookingDays ?? 14
  return Array.from({ length: count }, (_, index) => addDaysKey(base, index))
})

const mobileSection = ref<'schedule' | 'query'>('schedule')
const collapsedMachines = ref<Set<string>>(new Set())
const dateStripRef = ref<HTMLElement | null>(null)

const entriesByMachine = computed(() => {
  const map = new Map<string, PublicReservationEntry[]>()
  for (const entry of schedule.value?.reservations ?? []) {
    const list = map.get(entry.machineId) ?? []
    list.push(entry)
    map.set(entry.machineId, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }
  return map
})

const stats = computed(() => {
  const data = schedule.value
  const reservations = data?.reservations ?? []
  return {
    confirmed: reservations
      .filter((entry) => entry.status === 'approved')
      .reduce((sum, entry) => sum + entry.partySize, 0),
    pending: reservations
      .filter((entry) => entry.status === 'pending')
      .reduce((sum, entry) => sum + entry.partySize, 0),
    records: reservations.length,
    online: data?.machines.filter((machine) => machine.status.state !== 'offline').length ?? 0,
    total: data?.machines.length ?? 0,
    players: data?.machines.filter((machine) => machine.status.state === 'playing').length ?? 0,
  }
})

function entriesFor(machineId: string) {
  return entriesByMachine.value.get(machineId) ?? []
}

function isCollapsed(machineId: string) {
  return collapsedMachines.value.has(machineId)
}

function toggleMachine(machineId: string) {
  const next = new Set(collapsedMachines.value)
  if (next.has(machineId)) next.delete(machineId)
  else next.add(machineId)
  collapsedMachines.value = next
}

async function scrollDateIntoView() {
  await nextTick()
  const active = dateStripRef.value?.querySelector<HTMLElement>('[aria-pressed="true"]')
  active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

onMounted(scrollDateIntoView)
watch(selectedDate, scrollDateIntoView)

function setDate(date: string) {
  if (date === selectedDate.value) return
  selectedDate.value = date
  router.replace({ query: { ...route.query, date } })
}

watch(
  () => route.query.date,
  (value) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value !== selectedDate.value) {
      selectedDate.value = value
    }
  },
)

const dialogOpen = ref(false)
const initialMachineId = ref<string>()
const initialStartTime = ref<string>()
const initialEndTime = ref<string>()

function openNewBooking() {
  const data = schedule.value
  if (!data) return
  if (data.machines.length === 0) {
    toast.info('还没有可预约的机台', { description: '管理员添加机台后即可预约。' })
    return
  }
  mobileSection.value = 'schedule'
  const firstOpen = data.cells.find((cell) => cell.state === 'available' || cell.state === 'limited')
  initialMachineId.value = firstOpen?.machineId
  initialStartTime.value = firstOpen?.slotStart
  initialEndTime.value = firstOpen?.slotEnd
  dialogOpen.value = true
}


function refresh() {
  scheduleQuery.refetch()
}

function reservationLabel(entry: PublicReservationEntry) {
  return entry.status === 'approved' ? '已确认' : '待审批'
}

function reservationTone(entry: PublicReservationEntry) {
  return entry.status === 'approved' ? ('success' as const) : ('warning' as const)
}

function machineTone(machine: Machine) {
  return machineStateTone(machine.status.state)
}
</script>

<template>
  <div class="space-y-5">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">机台预约</h1>
        <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          按机台查看已有预约信息，未产生预约的时段不会显示。需要预约请点击「新建预约」。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :class="mobileSection === 'query' ? 'hidden xl:inline-flex' : ''"
          :disabled="isRefreshing"
          @click="refresh"
        >
          <RefreshCw :class="cn('size-4', isRefreshing && 'animate-spin')" />
          刷新
        </Button>
        <Button size="sm" @click="openNewBooking">
          <CalendarDays class="size-4" />
          新建预约
        </Button>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 xl:hidden">
      <button
        type="button"
        data-testid="tab-schedule"
        class="flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors"
        :class="mobileSection === 'schedule' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
        @click="mobileSection = 'schedule'"
      >
        <CalendarDays class="size-4" />
        预约信息
      </button>
      <button
        type="button"
        data-testid="tab-query"
        class="flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors"
        :class="mobileSection === 'query' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
        @click="mobileSection = 'query'"
      >
        <Search class="size-4" />
        查询预约
      </button>
    </div>

    <div :class="mobileSection === 'schedule' ? 'space-y-5' : 'hidden xl:block xl:space-y-5'">
      <div class="hidden grid-cols-2 gap-3 sm:grid sm:grid-cols-4">
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">已确认</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">
            {{ stats.confirmed }}<span class="ml-1 text-sm font-normal text-muted-foreground">人</span>
          </p>
        </Card>
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">待审批</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">
            {{ stats.pending }}<span class="ml-1 text-sm font-normal text-muted-foreground">人</span>
          </p>
        </Card>
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">预约记录</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">
            {{ stats.records }}<span class="ml-1 text-sm font-normal text-muted-foreground">条</span>
          </p>
        </Card>
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">在线机台</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">
            {{ stats.online }}<span class="ml-1 text-sm font-normal text-muted-foreground">/{{ stats.total }}</span>
          </p>
          <p class="mt-1 text-[11px] text-muted-foreground">{{ stats.players }} 台游玩中</p>
        </Card>
      </div>

      <div class="flex items-center justify-between gap-3 sm:hidden">
        <p class="text-sm text-foreground">{{ formatDateLong(selectedDate) }}</p>
        <p class="text-xs text-muted-foreground">{{ stats.records }} 条预约记录</p>
      </div>

      <Card class="p-2">
        <div ref="dateStripRef" class="flex snap-x gap-1 overflow-x-auto">
          <button
            v-for="day in days"
            :key="day"
            type="button"
            data-testid="date-chip"
            :aria-pressed="day === selectedDate"
            class="relative flex min-w-[60px] shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-2.5 transition-colors"
            :class="
              day === selectedDate
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            "
            @click="setDate(day)"
          >
            <span class="text-[11px]">{{ formatWeekday(day) }}</span>
            <span class="text-sm font-medium number-tabular">{{ formatMonthDay(day) }}</span>
            <span
              v-if="schedule && isDateKeyToday(day, schedule.today)"
              class="size-1 rounded-full"
              :class="day === selectedDate ? 'bg-primary-foreground' : 'bg-primary'"
              aria-label="今天"
            />
          </button>
        </div>
      </Card>
    </div>

    <div v-if="scheduleQuery.isError.value" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
      <div class="flex items-start gap-3">
        <AlertTriangle class="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p class="text-sm font-medium text-foreground">预约信息加载失败</p>
          <p class="mt-1 text-sm text-muted-foreground">请稍后重试。</p>
          <Button variant="outline" size="sm" class="mt-3" @click="refresh">
            <RefreshCw class="size-4" />重新加载
          </Button>
        </div>
      </div>
    </div>

    <div v-if="schedule" class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div :class="mobileSection === 'schedule' ? 'min-w-0 space-y-3' : 'hidden min-w-0 space-y-3 xl:block'">
        <Card v-if="schedule.machines.length === 0" class="px-4 py-14 text-center">
          <Gamepad2 class="mx-auto size-6 text-muted-foreground" />
          <p class="mt-2 text-sm font-medium text-foreground">还没有可预约的机台</p>
          <p class="mt-1 text-xs text-muted-foreground">管理员在后台添加机台后，这里会显示预约信息。</p>
        </Card>

        <Card v-for="machine in schedule.machines" :key="machine.id" class="overflow-hidden">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
            :aria-expanded="!isCollapsed(machine.id)"
            :aria-controls="`machine-panel-${machine.id}`"
            @click="toggleMachine(machine.id)"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Gamepad2 class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="truncate text-sm font-semibold text-foreground">{{ machine.name }}</span>
                <Badge :variant="machineTone(machine)">{{ machineStateLabel(machine.status.state) }}</Badge>
              </span>
              <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                {{ machine.softwareVersion || '未设置版本' }} · 容量 {{ machine.capacity }} 人
              </span>
            </span>
            <span class="shrink-0 text-xs text-muted-foreground">
              {{ entriesFor(machine.id).length }} 条预约
            </span>
            <ChevronDown
              class="size-4 shrink-0 text-muted-foreground transition-transform"
              :class="isCollapsed(machine.id) ? '-rotate-90' : ''"
            />
          </button>

          <div
            :id="`machine-panel-${machine.id}`"
            class="grid transition-[grid-template-rows] duration-200 ease-out"
            :class="isCollapsed(machine.id) ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
            :aria-hidden="isCollapsed(machine.id)"
          >
            <div class="overflow-hidden">
              <div class="border-t border-border">
                <div v-if="entriesFor(machine.id).length === 0" class="px-4 py-5 text-center text-xs text-muted-foreground">
                  暂无预约
                </div>
                <div v-else class="divide-y divide-border">
                  <div
                    v-for="(entry, index) in entriesFor(machine.id)"
                    :key="`${machine.id}-${entry.startTime}-${entry.endTime}-${index}`"
                    class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                  >
                    <span class="flex w-28 shrink-0 items-center gap-1.5 text-sm font-medium text-foreground number-tabular">
                      <Clock3 class="size-3.5 text-muted-foreground" />
                      {{ entry.startTime }}–{{ entry.endTime }}
                    </span>
                    <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users class="size-3.5" />
                      <span class="font-medium text-foreground">{{ entry.nickname || '匿名' }}</span>
                      · {{ entry.partySize }} 人
                    </span>
                    <Badge :variant="reservationTone(entry)">{{ reservationLabel(entry) }}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div class="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck class="mt-0.5 size-4 shrink-0 text-primary" />
          公开页面只展示昵称、时段、人数与审批状态，不展示姓名、学号、专业班级和邮箱。
        </div>
      </div>

      <aside :class="mobileSection === 'query' ? 'space-y-4' : 'hidden space-y-4 xl:block'">
        <ReservationLookupPanel />

        <Card class="p-4">
          <h2 class="text-sm font-semibold text-foreground">预约说明</h2>
          <ul class="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <li class="flex gap-2.5">
              <Mail class="mt-0.5 size-4 shrink-0" />
              邮箱仅用于接收审批结果，不会公开展示。
            </li>
            <li class="flex gap-2.5">
              <CheckCircle2 class="mt-0.5 size-4 shrink-0" />
              待审批同样占用名额，通过后正式确认。
            </li>
            <li class="flex gap-2.5">
              <Users class="mt-0.5 size-4 shrink-0" />
              单次最多 {{ schedule.maxSlots }} 个连续时段。
            </li>
            <li class="flex gap-2.5">
              <Clock3 class="mt-0.5 size-4 shrink-0" />
              已开始的时段不可预约，取消需在开始前操作。
            </li>
            <li class="flex gap-2.5">
              <Wifi class="mt-0.5 size-4 shrink-0" />
              机台实时状态可在「机台」页查看。
            </li>
          </ul>
        </Card>
      </aside>
    </div>

    <div v-if="!schedule && !isInitialLoading && !scheduleQuery.isError.value" class="py-14 text-center text-sm text-muted-foreground">
      <LoaderCircle class="mx-auto mb-2 size-5 animate-spin text-primary" />
      正在加载预约信息…
    </div>

    <BookingDialog
      v-if="schedule"
      v-model:open="dialogOpen"
      :schedule="schedule"
      :initial-machine-id="initialMachineId"
      :initial-start-time="initialStartTime"
      :initial-end-time="initialEndTime"

    />
  </div>
</template>
