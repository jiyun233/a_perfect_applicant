<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import {
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { api, errorMessage } from '@/lib/api/client'
import type { Reservation } from '@/lib/api/types'
import { formatDateLong } from '@/lib/date'
import { reservationTone } from '@/lib/status'

const inputStudentId = ref('')
const queriedStudentId = ref('')
const results = ref<Reservation[]>([])
const hasSearched = ref(false)
const isSearching = ref(false)
const searchError = ref('')
const cancelTarget = ref<Reservation | null>(null)
const cancelOpen = ref(false)

watch(inputStudentId, () => {
  if (searchError.value) searchError.value = ''
})

const cancelMutation = useMutation({
  mutationFn: (code: string) => api.cancelReservation(code),
  onSuccess: (data) => {
    results.value = results.value.map((item) =>
      item.id === data.reservation.id ? data.reservation : item,
    )
    cancelOpen.value = false
    cancelTarget.value = null
    toast.success('预约已取消')
  },
  onError: (error) => {
    toast.error('取消失败', { description: errorMessage(error) })
  },
})

const cancelDescription = computed(() => {
  const item = cancelTarget.value
  if (!item) return ''
  return `${item.machine.name} · ${formatDateLong(item.date)} ${item.startTime}–${item.endTime}。取消后名额会立即释放。`
})

function normalizeStudentId(value: string) {
  return value.trim()
}

async function search() {
  const studentId = normalizeStudentId(inputStudentId.value)
  searchError.value = ''
  if (!/^2\d(40|50)\d{6}$/.test(studentId)) {
    searchError.value = '请输入 10 位学号，第 3–4 位为 40 或 50'
    return
  }
  isSearching.value = true
  try {
    const data = await api.getReservationsByStudent(studentId)
    queriedStudentId.value = studentId
    results.value = data.reservations
    hasSearched.value = true
  } catch (error) {
    results.value = []
    hasSearched.value = true
    searchError.value = errorMessage(error)
  } finally {
    isSearching.value = false
  }
}

function refresh() {
  if (!queriedStudentId.value) return
  inputStudentId.value = queriedStudentId.value
  void search()
}

function clearSearch() {
  inputStudentId.value = ''
  queriedStudentId.value = ''
  results.value = []
  hasSearched.value = false
  searchError.value = ''
}

function askCancel(item: Reservation) {
  if (!item.code) return
  cancelTarget.value = item
  cancelOpen.value = true
}

function confirmCancel() {
  if (cancelTarget.value?.code) cancelMutation.mutate(cancelTarget.value.code)
}
</script>

<template>
  <Card>
    <div class="flex items-center justify-between border-b border-border px-4 py-3.5">
      <div class="flex items-center gap-2">
        <Search class="size-4 text-muted-foreground" />
        <h2 class="text-sm font-semibold text-foreground">查询预约</h2>
      </div>
      <Button
        v-if="hasSearched"
        variant="ghost"
        size="icon-sm"
        aria-label="刷新预约信息"
        :disabled="isSearching"
        @click="refresh"
      >
        <RefreshCw :class="['size-4', isSearching && 'animate-spin']" />
      </Button>
    </div>

    <div class="space-y-4 p-4">
      <p class="text-xs leading-relaxed text-muted-foreground">
        输入学号查询你的预约记录。姓名、学号、专业班级不会在公开页面展示。
      </p>

      <form class="space-y-2" @submit.prevent="search">
        <div class="flex gap-2">
          <div class="relative min-w-0 flex-1">
            <Input
              v-model="inputStudentId"
              placeholder="2x40xxxxxx"
              inputmode="numeric"
              maxlength="10"
              class="pr-12 font-mono tracking-wide"
              aria-label="学号"
              autocomplete="off"
              enterkeyhint="search"
            />
            <button
              v-if="inputStudentId"
              type="button"
              class="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:size-10"
              aria-label="清空学号"
              @click="inputStudentId = ''"
            >
              <X class="size-4" />
            </button>
          </div>
          <Button type="submit" size="icon" :disabled="isSearching" aria-label="查询预约信息">
            <LoaderCircle v-if="isSearching" class="animate-spin" />
            <Search v-else class="size-4" />
          </Button>
        </div>
        <p v-if="searchError" class="text-xs text-destructive">{{ searchError }}</p>
      </form>

      <div v-if="!hasSearched" class="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <CalendarClock class="mx-auto size-5 text-muted-foreground" />
        <p class="mt-2 text-sm font-medium text-foreground">输入学号查询</p>
        <p class="mt-1 text-xs text-muted-foreground">可以查看审批状态、时段和机台信息。</p>
      </div>

      <div
        v-else-if="results.length === 0 && !searchError"
        class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
      >
        该学号暂无预约
      </div>

      <div v-else-if="results.length" class="space-y-3" aria-live="polite">
        <p class="text-[11px] text-muted-foreground">共 {{ results.length }} 条预约</p>
        <div
          v-for="item in results"
          :key="item.id"
          class="rounded-lg border border-border bg-background p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <Badge :variant="reservationTone(item.status)">{{ item.statusLabel }}</Badge>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {{ item.machine.name }}
            </span>
            <Button
              v-if="item.canCancel"
              variant="ghost"
              size="sm"
              class="px-2 text-destructive"
              @click="askCancel(item)"
            >
              取消
            </Button>
          </div>

          <p class="mt-2 text-xs text-muted-foreground">
            {{ formatDateLong(item.date) }} ·
            <span class="font-mono">{{ item.startTime }}–{{ item.endTime }}</span>
            · {{ item.partySize }} 人
          </p>
          <p v-if="item.nickname" class="mt-1 text-xs text-muted-foreground">
            昵称：<span class="text-foreground">{{ item.nickname }}</span>
          </p>

          <p
            v-if="item.status === 'pending'"
            class="mt-2 rounded bg-warning/10 px-2.5 py-2 text-xs leading-relaxed text-warning"
          >
            等待管理员审批，结果会发送到邮箱。
          </p>
          <p
            v-else-if="item.status === 'approved'"
            class="mt-2 flex items-center gap-1.5 rounded bg-success/10 px-2.5 py-2 text-xs leading-relaxed text-success"
          >
            <CheckCircle2 class="size-3.5 shrink-0" />
            已通过审批，请按时到场。
          </p>
          <p
            v-else-if="item.status === 'rejected' && item.rejectionReason"
            class="mt-2 rounded bg-destructive/5 px-2.5 py-2 text-xs leading-relaxed text-destructive"
          >
            {{ item.rejectionReason }}
          </p>
        </div>
      </div>

      <button
        v-if="hasSearched"
        type="button"
        class="min-h-11 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        @click="clearSearch"
      >
        查询其他学号
      </button>
    </div>
  </Card>

  <ConfirmDialog
    :open="cancelOpen"
    title="取消这次预约？"
    :description="cancelDescription"
    confirm-label="确认取消"
    destructive
    :loading="cancelMutation.isPending.value"
    @update:open="cancelOpen = $event"
    @confirm="confirmCancel"
  />
</template>
