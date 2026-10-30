<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRoute } from 'vue-router'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardCheck,
  Copy,
  LoaderCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api, errorMessage } from '@/lib/api/client'
import type { EmailRecord, Reservation } from '@/lib/api/types'
import { formatDateLong, formatDateTime } from '@/lib/date'
import { emailStatusLabel, emailStatusTone, reservationTone } from '@/lib/status'
import { copyToClipboard } from '@/lib/utils'

const queryClient = useQueryClient()
const route = useRoute()
const routeStatus = typeof route.query.status === 'string' ? route.query.status : ''
const initialStatus = ['pending', 'approved', 'rejected', 'cancelled', 'expired'].includes(routeStatus)
  ? routeStatus
  : 'pending'

const machinesQuery = useQuery({
  queryKey: ['admin-machines'],
  queryFn: () => api.adminMachines(),
  staleTime: 60_000,
})

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待审批' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '未通过' },
  { value: 'cancelled', label: '已取消' },
  { value: 'expired', label: '已过期' },
]

const filters = reactive({ date: '', status: initialStatus, machineId: '', q: '' })
const applied = reactive({ ...filters })

const listQuery = useQuery({
  queryKey: computed(() => [
    'admin-reservations',
    applied.date,
    applied.status,
    applied.machineId,
    applied.q,
  ]),
  queryFn: () =>
    api.adminReservations({
      date: applied.date || undefined,
      status: applied.status || undefined,
      machineId: applied.machineId || undefined,
      q: applied.q || undefined,
    }),
  refetchInterval: 20_000,
})

const reservations = computed(() => listQuery.data.value?.reservations ?? [])
const machines = computed(() => machinesQuery.data.value?.machines ?? [])
const machineOptions = computed(() => [
  { value: '', label: '全部机台' },
  ...machines.value.map((machine) => ({ value: machine.id, label: machine.name })),
])
const listLoading = computed(() => listQuery.isPending.value && !listQuery.data.value)
const listError = computed(() => listQuery.isError.value)

const detailOpen = ref(false)
const detailId = ref<string | null>(null)
const detailQuery = useQuery({
  queryKey: computed(() => ['admin-reservation', detailId.value]),
  queryFn: () => api.adminReservation(detailId.value!),
  enabled: computed(() => Boolean(detailId.value)),
})

const detail = computed(() => detailQuery.data.value?.reservation ?? null)
const emails = computed<EmailRecord[]>(() => detailQuery.data.value?.emails ?? [])
const detailLoading = computed(() => detailQuery.isPending.value && detailOpen.value)

const confirmAction = ref<'approve' | 'cancel' | null>(null)
const rejectMode = ref(false)
const rejectReason = ref('')
const actionError = ref('')

watch(detailId, () => {
  confirmAction.value = null
  rejectMode.value = false
  rejectReason.value = ''
  actionError.value = ''
})

function applyFilters() {
  Object.assign(applied, filters)
}

function resetFilters() {
  Object.assign(filters, { date: '', status: 'pending', machineId: '', q: '' })
  applyFilters()
}

function openDetail(reservation: Reservation) {
  detailId.value = reservation.id
  detailOpen.value = true
  confirmAction.value = null
  rejectMode.value = false
  rejectReason.value = ''
  actionError.value = ''
}

function closeDetail(value: boolean) {
  if (!value) {
    detailOpen.value = false
    detailId.value = null
  }
}

function statusVariant(status: Reservation['status']) {
  return reservationTone(status)
}

function canApprove(reservation: Reservation | null) {
  return reservation?.status === 'pending'
}

function canReject(reservation: Reservation | null) {
  return reservation?.status === 'pending'
}

function canCancel(reservation: Reservation | null) {
  return reservation?.status === 'pending' || reservation?.status === 'approved'
}

async function invalidateAll() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-reservations'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-reservation', detailId.value] }),
  ])
}

const approveMutation = useMutation({
  mutationFn: (id: string) => api.adminApproveReservation(id),
  onSuccess: async () => {
    toast.success('预约已通过')
    confirmAction.value = null
    await invalidateAll()
  },
  onError: (error) => {
    actionError.value = errorMessage(error)
    toast.error('审批失败', { description: errorMessage(error) })
  },
})

const rejectMutation = useMutation({
  mutationFn: () => {
    if (!detail.value) throw new Error('missing reservation')
    return api.adminRejectReservation(detail.value.id, rejectReason.value.trim())
  },
  onSuccess: async () => {
    toast.success('预约已拒绝')
    rejectMode.value = false
    rejectReason.value = ''
    await invalidateAll()
  },
  onError: (error) => {
    actionError.value = errorMessage(error)
    toast.error('操作失败', { description: errorMessage(error) })
  },
})

const cancelMutation = useMutation({
  mutationFn: () => {
    if (!detail.value) throw new Error('missing reservation')
    return api.adminCancelReservation(detail.value.id, '管理员取消预约')
  },
  onSuccess: async () => {
    toast.success('预约已取消')
    confirmAction.value = null
    await invalidateAll()
  },
  onError: (error) => {
    actionError.value = errorMessage(error)
    toast.error('取消失败', { description: errorMessage(error) })
  },
})

const retryEmailMutation = useMutation({
  mutationFn: (id: string) => api.adminRetryEmail(id),
  onSuccess: async () => {
    toast.success('邮件已重新入队')
    await queryClient.invalidateQueries({ queryKey: ['admin-reservation', detailId.value] })
    await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
  },
  onError: (error) => toast.error('重试失败', { description: errorMessage(error) }),
})

function submitReject() {
  actionError.value = ''
  if (rejectReason.value.trim().length < 2) {
    actionError.value = '请填写拒绝原因（至少 2 个字符）'
    return
  }
  rejectMutation.mutate()
}

function executeConfirm() {
  actionError.value = ''
  if (!detail.value) return
  if (confirmAction.value === 'approve') approveMutation.mutate(detail.value.id)
  if (confirmAction.value === 'cancel') cancelMutation.mutate()
}

async function copyCode(code: string | undefined) {
  if (!code) return
  if (await copyToClipboard(code)) toast.success('预约码已复制')
  else toast.error('复制失败')
}

function refreshDetail() {
  detailQuery.refetch()
}
</script>

<template>
  <div class="space-y-5">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">预约审批</h1>
        <p class="mt-1.5 text-sm text-muted-foreground">审批后自动发送邮件，并同步成员端状态。</p>
      </div>
      <Button variant="outline" size="sm" :disabled="listQuery.isFetching.value" @click="listQuery.refetch()">
        <RefreshCw :class="['size-4', listQuery.isFetching.value && 'animate-spin']" />
        刷新
      </Button>
    </section>

    <Card class="p-3">
      <form class="grid grid-cols-2 gap-2 sm:grid-cols-[140px_140px_160px_minmax(0,1fr)_120px]" @submit.prevent="applyFilters">
        <div class="space-y-1.5">
          <Label for="filter-date" class="text-xs text-muted-foreground">日期</Label>
          <Input id="filter-date" v-model="filters.date" type="date" class="h-10 text-sm" />
        </div>
        <div class="space-y-1.5">
          <Label for="filter-status" class="text-xs text-muted-foreground">状态</Label>
          <Select id="filter-status" v-model="filters.status" :options="statusOptions" />
        </div>
        <div class="space-y-1.5">
          <Label for="filter-machine" class="text-xs text-muted-foreground">机台</Label>
          <Select id="filter-machine" v-model="filters.machineId" :options="machineOptions" />
        </div>
        <div class="col-span-2 space-y-1.5 sm:col-span-1">
          <Label for="filter-search" class="text-xs text-muted-foreground">搜索</Label>
          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="filter-search" v-model="filters.q" class="pl-9" placeholder="姓名、学号、昵称或邮箱" />
          </div>
        </div>
        <div class="col-span-2 flex items-end gap-2 sm:col-span-1">
          <Button type="submit" size="sm" class="w-full whitespace-nowrap">筛选</Button>
          <Button type="button" variant="outline" size="icon" aria-label="重置筛选" @click="resetFilters">
            <RotateCcw class="size-4" />
          </Button>
        </div>
      </form>
    </Card>

    <Card class="overflow-hidden">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="flex items-center gap-2">
          <ClipboardCheck class="size-4 text-muted-foreground" />
          <span class="text-sm font-medium text-foreground">预约列表</span>
          <Badge variant="outline">{{ reservations.length }}</Badge>
        </div>
        <span class="hidden text-[11px] text-muted-foreground sm:block">点击查看详情</span>
      </div>

      <div v-if="listLoading" class="space-y-2 p-4">
        <Skeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-lg" />
      </div>
      <div v-else-if="listError" class="flex items-start gap-3 p-4">
        <AlertTriangle class="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p class="text-sm font-medium text-foreground">预约列表加载失败</p>
          <p class="mt-1 text-xs text-muted-foreground">请确认登录状态或稍后重试。</p>
          <Button variant="outline" size="sm" class="mt-3" @click="listQuery.refetch()">重新加载</Button>
        </div>
      </div>
      <div v-else-if="reservations.length === 0" class="px-4 py-14 text-center">
        <ClipboardCheck class="mx-auto size-6 text-muted-foreground" />
        <p class="mt-2 text-sm font-medium text-foreground">没有符合条件的预约</p>
        <p class="mt-1 text-xs text-muted-foreground">调整筛选条件或等待新的预约。</p>
      </div>

      <div v-else class="hidden overflow-x-auto md:block">
        <table class="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs text-muted-foreground">
              <th class="px-4 py-2.5 font-medium">时段</th>
              <th class="px-4 py-2.5 font-medium">机台</th>
              <th class="px-4 py-2.5 font-medium">申请人</th>
              <th class="px-4 py-2.5 font-medium">人数</th>
              <th class="px-4 py-2.5 font-medium">状态</th>
              <th class="px-4 py-2.5 font-medium">邮件</th>
              <th class="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="item in reservations"
              :key="item.id"
              class="cursor-pointer hover:bg-muted/40"
              @click="openDetail(item)"
            >
              <td class="px-4 py-3">
                <p class="text-sm text-foreground">{{ item.date }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">{{ item.startTime }}–{{ item.endTime }}</p>
              </td>
              <td class="px-4 py-3">
                <p class="text-sm text-foreground">{{ item.machine.name }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">{{ item.machine.code }}</p>
              </td>
              <td class="px-4 py-3">
                <p class="text-sm text-foreground">{{ item.applicantName }}</p>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ item.studentId || item.email }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-muted-foreground number-tabular">{{ item.partySize }}</td>
              <td class="px-4 py-3"><Badge :variant="statusVariant(item.status)">{{ item.statusLabel }}</Badge></td>
              <td class="px-4 py-3"><Badge :variant="emailStatusTone(item.emailStatus)">{{ emailStatusLabel(item.emailStatus) }}</Badge></td>
              <td class="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" @click.stop="openDetail(item)">详情</Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="reservations.length" class="divide-y divide-border md:hidden">
        <button
          v-for="item in reservations"
          :key="item.id"
          type="button"
          class="w-full p-4 text-left"
          @click="openDetail(item)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-foreground">{{ item.machine.name }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ item.date }} · {{ item.startTime }}–{{ item.endTime }}
              </p>
            </div>
            <Badge :variant="statusVariant(item.status)">{{ item.statusLabel }}</Badge>
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span class="truncate">{{ item.applicantName }} · {{ item.partySize }} 人</span>
            <span class="flex items-center gap-1">
              <Mail class="size-3.5" />
              {{ emailStatusLabel(item.emailStatus) }}
            </span>
          </div>
        </button>
      </div>

      <div class="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        <span>共 {{ reservations.length }} 条，最多 300 条</span>
        <span>每 20 秒同步</span>
      </div>
    </Card>

    <Dialog
      :open="detailOpen"
      title="预约详情"
      :description="detail ? `${detail.machine.name} · ${formatDateLong(detail.date)} ${detail.startTime}–${detail.endTime}` : '加载中…'"
      class="max-w-2xl"
      @update:open="closeDetail"
    >
      <div v-if="detailLoading" class="space-y-3">
        <Skeleton class="h-24 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
      </div>
      <div v-else-if="detail" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <Badge :variant="statusVariant(detail.status)">{{ detail.statusLabel }}</Badge>
          <button
            v-if="detail.code"
            type="button"
            class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-muted"
            @click="copyCode(detail.code)"
          >
            {{ detail.code }} <Copy class="size-3" />
          </button>
          <Badge :variant="emailStatusTone(detail.emailStatus)">邮件{{ emailStatusLabel(detail.emailStatus) }}</Badge>
          <Button variant="ghost" size="icon-sm" class="ml-auto" aria-label="刷新详情" @click="refreshDetail">
            <RefreshCw class="size-4" />
          </Button>
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">申请人</p>
            <p class="mt-1 text-sm font-medium text-foreground">{{ detail.applicantName }}</p>
            <p class="mt-0.5 break-all text-xs text-muted-foreground">{{ detail.email }}</p>
            <p class="mt-1 text-xs text-muted-foreground">昵称：{{ detail.nickname || '—' }}</p>
          </div>
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">学号 / 专业班级</p>
            <p class="mt-1 font-mono text-sm text-foreground">{{ detail.studentId || '—' }}</p>
            <p class="mt-0.5 break-all text-xs text-muted-foreground">{{ detail.majorClass || '—' }}</p>
          </div>
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">时段</p>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-foreground">
              <CalendarDays class="size-4 text-muted-foreground" />{{ detail.date }}
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ detail.startTime }}–{{ detail.endTime }} · {{ detail.partySize }} 人</p>
          </div>
          <div class="rounded-lg border border-border p-3 sm:col-span-2">
            <p class="text-xs text-muted-foreground">机台与备注</p>
            <p class="mt-1 text-sm text-foreground">{{ detail.machine.name }} · {{ detail.machine.game }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">版本 {{ detail.machine.softwareVersion || '—' }} · {{ detail.machine.location || '未设置位置' }}</p>
            <p v-if="detail.note" class="mt-2 rounded bg-muted px-2.5 py-2 text-xs text-muted-foreground">{{ detail.note }}</p>
            <p v-if="detail.rejectionReason" class="mt-2 rounded bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              拒绝原因：{{ detail.rejectionReason }}
            </p>
          </div>
        </div>

        <div class="rounded-lg border border-border">
          <div class="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p class="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Mail class="size-4 text-muted-foreground" />通知邮件
            </p>
            <span class="text-[11px] text-muted-foreground">{{ emails.length }} 条</span>
          </div>
          <div v-if="emails.length === 0" class="px-3 py-4 text-xs text-muted-foreground">暂无邮件记录</div>
          <div v-else class="divide-y divide-border">
            <div v-for="email in emails" :key="email.id" class="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <Badge :variant="emailStatusTone(email.status)">{{ emailStatusLabel(email.status) }}</Badge>
              <span class="text-xs text-muted-foreground">{{ email.template }}</span>
              <span class="text-[11px] text-muted-foreground">{{ formatDateTime(email.createdAt) }} · {{ email.attempts }} 次</span>
              <span v-if="email.lastError" class="w-full break-all text-[11px] text-destructive">{{ email.lastError }}</span>
              <Button
                v-if="email.status === 'failed' || email.status === 'pending'"
                variant="ghost"
                size="sm"
                class="ml-auto"
                :disabled="retryEmailMutation.isPending.value"
                @click="retryEmailMutation.mutate(email.id)"
              >
                <LoaderCircle v-if="retryEmailMutation.isPending.value" class="animate-spin" />
                <RotateCcw v-else class="size-3.5" />
                重发
              </Button>
            </div>
          </div>
        </div>

        <div v-if="actionError" class="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {{ actionError }}
        </div>

        <div v-if="confirmAction" class="rounded-lg border border-border bg-muted/50 p-3">
          <p class="text-sm font-medium text-foreground">
            {{ confirmAction === 'approve' ? '确认通过这次预约？' : '确认取消这次预约？' }}
          </p>
          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
            {{
              confirmAction === 'approve'
                ? `将向 ${detail.email} 发送审批通过邮件。`
                : `将向 ${detail.email} 发送取消通知，名额会释放。`
            }}
          </p>
          <div class="mt-3 flex gap-2">
            <Button
              size="sm"
              :variant="confirmAction === 'cancel' ? 'destructive' : 'default'"
              :disabled="approveMutation.isPending.value || cancelMutation.isPending.value"
              @click="executeConfirm"
            >
              <LoaderCircle v-if="approveMutation.isPending.value || cancelMutation.isPending.value" class="animate-spin" />
              <Check v-else class="size-4" />
              {{ confirmAction === 'approve' ? '确认通过' : '确认取消' }}
            </Button>
            <Button size="sm" variant="ghost" @click="confirmAction = null">返回</Button>
          </div>
        </div>

        <div v-else-if="rejectMode" class="rounded-lg border border-border bg-muted/50 p-3">
          <Label for="reject-reason" class="text-sm">拒绝原因</Label>
          <Textarea id="reject-reason" v-model="rejectReason" class="mt-2" maxlength="300" placeholder="会随拒绝邮件发送给申请人" />
          <div class="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" @click="rejectMode = false">取消</Button>
            <Button size="sm" variant="destructive" :disabled="rejectMutation.isPending.value" @click="submitReject">
              <LoaderCircle v-if="rejectMutation.isPending.value" class="animate-spin" />
              拒绝并发送邮件
            </Button>
          </div>
        </div>
      </div>

      <template #footer>
        <template v-if="detail">
          <Button variant="ghost" class="w-full sm:w-auto" @click="closeDetail(false)">关闭</Button>
          <Button
            v-if="canReject(detail)"
            variant="outline"
            class="w-full text-destructive hover:bg-destructive/5 sm:w-auto"
            @click="rejectMode = true; confirmAction = null"
          >
            <X class="size-4" /> 拒绝
          </Button>
          <Button
            v-if="canApprove(detail)"
            class="w-full sm:w-auto"
            :disabled="approveMutation.isPending.value"
            @click="confirmAction = 'approve'; rejectMode = false"
          >
            <Check class="size-4" /> 通过预约
          </Button>
          <Button
            v-if="canCancel(detail) && !canApprove(detail)"
            variant="destructive"
            class="w-full sm:w-auto"
            @click="confirmAction = 'cancel'; rejectMode = false"
          >
            取消预约
          </Button>
        </template>
      </template>
    </Dialog>
  </div>
</template>
