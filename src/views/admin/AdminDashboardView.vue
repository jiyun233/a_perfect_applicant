<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { RouterLink } from 'vue-router'
import {
  ArrowRight,
  ClipboardCheck,
  Gamepad2,
  MailWarning,
  RefreshCw,
  Wifi,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api/client'
import type { Reservation } from '@/lib/api/types'
import { formatDateLong, formatDateTime, relativeTime } from '@/lib/date'
import { reservationTone } from '@/lib/status'
import { cn } from '@/lib/utils'

const dashboardQuery = useQuery({
  queryKey: ['admin-dashboard'],
  queryFn: () => api.adminDashboard(),
  refetchInterval: 30_000,
})

const data = computed(() => dashboardQuery.data.value ?? null)
const stats = computed(() => data.value?.stats)
const pending = computed(() => data.value?.pending ?? [])
const lastUpdated = computed(() =>
  dashboardQuery.dataUpdatedAt.value ? new Date(dashboardQuery.dataUpdatedAt.value) : null,
)
const isLogMail = computed(() => data.value?.mailDriver?.startsWith('log'))

function statusVariant(status: Reservation['status']) {
  return reservationTone(status)
}
</script>

<template>
  <div class="space-y-5">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">概览</h1>
        <p class="mt-1.5 text-sm text-muted-foreground">处理待审批预约，检查机台与通知状态。</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">{{ lastUpdated ? `${relativeTime(lastUpdated)}更新` : '—' }}</span>
        <Button variant="outline" size="sm" :disabled="dashboardQuery.isFetching.value" @click="dashboardQuery.refetch()">
          <RefreshCw :class="cn('size-4', dashboardQuery.isFetching.value && 'animate-spin')" />
          刷新
        </Button>
      </div>
    </section>

    <div v-if="dashboardQuery.isPending.value" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
    </div>
    <div v-else-if="dashboardQuery.isError.value" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
      <p class="text-sm font-medium text-foreground">概览加载失败</p>
      <p class="mt-1 text-sm text-muted-foreground">请确认登录状态后重试。</p>
      <Button variant="outline" size="sm" class="mt-3" @click="dashboardQuery.refetch()">重新加载</Button>
    </div>
    <template v-else-if="stats">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">待审批</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ stats.pendingReservations }}</p>
        </Card>
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">今日预约</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ stats.todayReservations }}</p>
        </Card>
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">在线机台</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">
            {{ stats.onlineMachines }}<span class="text-sm font-normal text-muted-foreground">/{{ stats.totalMachines }}</span>
          </p>
        </Card>
        <Card class="p-4">
          <p class="text-xs text-muted-foreground">失败邮件</p>
          <p class="mt-2 text-2xl font-semibold text-foreground number-tabular">{{ stats.failedEmails }}</p>
          <p class="mt-1 text-[11px] text-muted-foreground">{{ stats.pendingEmails }} 封待处理</p>
        </Card>
      </div>

      <div v-if="isLogMail" class="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning">
        <MailWarning class="mt-0.5 size-4 shrink-0" />
        <p class="leading-relaxed">当前邮件驱动为 log，审批结果只写入服务端日志。部署前请配置 SMTP。</p>
      </div>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <div class="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div class="flex items-center gap-2">
              <ClipboardCheck class="size-4 text-muted-foreground" />
              <h2 class="text-sm font-semibold text-foreground">待审批预约</h2>
            </div>
            <Button as-child variant="ghost" size="sm">
              <RouterLink to="/admin/reservations">
                全部 <ArrowRight class="size-4" />
              </RouterLink>
            </Button>
          </div>

          <div v-if="pending.length === 0" class="px-4 py-12 text-center">
            <ClipboardCheck class="mx-auto size-6 text-muted-foreground" />
            <p class="mt-2 text-sm font-medium text-foreground">没有待审批预约</p>
            <p class="mt-1 text-xs text-muted-foreground">新的预约提交后会出现在这里。</p>
          </div>
          <div v-else class="divide-y divide-border">
            <div v-for="item in pending" :key="item.id" class="flex items-center gap-3 px-4 py-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-foreground">{{ item.machine.name }}</span>
                  <Badge :variant="statusVariant(item.status)">{{ item.statusLabel }}</Badge>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ formatDateLong(item.date) }} · {{ item.startTime }}–{{ item.endTime }} · {{ item.partySize }} 人
                </p>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ item.applicantName }} · {{ item.email }}</p>
              </div>
              <Button as-child variant="outline" size="sm" class="shrink-0">
                <RouterLink to="/admin/reservations">处理</RouterLink>
              </Button>
            </div>
          </div>
        </Card>

        <div class="space-y-3">
          <Card class="p-4">
            <h2 class="text-sm font-semibold text-foreground">快捷入口</h2>
            <div class="mt-3 space-y-2">
              <RouterLink
                to="/admin/reservations"
                class="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <ClipboardCheck class="size-4 text-muted-foreground" />
                审批预约
                <ArrowRight class="ml-auto size-4 text-muted-foreground" />
              </RouterLink>
              <RouterLink
                to="/admin/machines"
                class="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Gamepad2 class="size-4 text-muted-foreground" />
                维护机台
                <ArrowRight class="ml-auto size-4 text-muted-foreground" />
              </RouterLink>
              <RouterLink
                to="/machines"
                target="_blank"
                class="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Wifi class="size-4 text-muted-foreground" />
                成员端状态
                <ArrowRight class="ml-auto size-4 text-muted-foreground" />
              </RouterLink>
            </div>
          </Card>

          <Card class="p-4">
            <h2 class="text-sm font-semibold text-foreground">通知服务</h2>
            <p class="mt-2 break-all font-mono text-xs leading-relaxed text-muted-foreground">{{ data?.mailDriver || '—' }}</p>
            <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
              审批操作会在同一事务内写入邮件队列，发送失败会自动重试。
            </p>
            <p class="mt-2 text-[11px] text-muted-foreground">
              服务时间 {{ data?.serverTime ? formatDateTime(data.serverTime) : '—' }}
            </p>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>
