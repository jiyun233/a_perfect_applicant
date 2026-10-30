<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { marked } from 'marked'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Mail,
  Users,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, errorMessage } from '@/lib/api/client'
import type { Schedule, ScheduleCell } from '@/lib/api/types'
import { formatDateLong } from '@/lib/date'
import bookingRules from '@/content/booking-rules.md?raw'
import TencentCaptchaChallenge from './TencentCaptchaChallenge.vue'

const props = defineProps<{
  open: boolean
  schedule: Schedule
  date: string
  dates: string[]
  dateLoading?: boolean
  initialMachineId?: string
  initialStartTime?: string
  initialEndTime?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
  'update:date': [value: string]
}>()

const queryClient = useQueryClient()

const form = reactive({
  machineId: '',
  startTime: '',
  endTime: '',
  partySize: 1,
  studentId: '',
  applicantName: '',
  majorClass: '',
  nickname: '',
  qq: '',
  email: '',
  note: '',
})
const localErrors = ref<Record<string, string>>({})
const serverFields = ref<Record<string, string>>({})
const succeeded = ref(false)
const failed = ref(false)
const failureMessage = ref('')
const failureRequestId = ref('')

const captchaAppId = String(import.meta.env.VITE_CAPTCHA_APP_ID || '')
const captchaEnabled = import.meta.env.VITE_CAPTCHA_ENABLED
  ? import.meta.env.VITE_CAPTCHA_ENABLED !== 'false'
  : import.meta.env.PROD
const captchaVerified = ref(false)
const captchaLoading = ref(false)
const captchaTicket = ref('')
const captchaRandstr = ref('')
const rulesAccepted = ref(false)
const step = ref<'form' | 'rules'>('form')
const rulesRemaining = ref(5)
const rulesHtml = computed(() => marked.parse(bookingRules, { async: false }) as string)
const mobileStep = ref<1 | 2>(1)
const isMobile = ref(
  typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
)
let rulesTimer: number | undefined
let mobileQuery: MediaQueryList | undefined

function resetCaptcha() {
  captchaVerified.value = false
  captchaTicket.value = ''
  captchaRandstr.value = ''
  captchaLoading.value = false
}

function stopRulesTimer() {
  if (rulesTimer !== undefined) {
    window.clearInterval(rulesTimer)
    rulesTimer = undefined
  }
}

function startRulesTimer() {
  stopRulesTimer()
  rulesRemaining.value = 5
  rulesTimer = window.setInterval(() => {
    if (rulesRemaining.value > 0) rulesRemaining.value -= 1
    if (rulesRemaining.value <= 0) stopRulesTimer()
  }, 1000)
}

function onRulesAccepted() {
  if (rulesRemaining.value > 0) return
  stopRulesTimer()
  rulesAccepted.value = true
  step.value = 'form'
  openCaptcha()
}

function syncMobile(event: MediaQueryList | MediaQueryListEvent) {
  isMobile.value = event.matches
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 639px)')
  isMobile.value = mobileQuery.matches
  mobileQuery.addEventListener('change', syncMobile)
})

onBeforeUnmount(() => {
  stopRulesTimer()
  mobileQuery?.removeEventListener('change', syncMobile)
})

async function scrollDialogToTop() {
  await nextTick()
  document.querySelector<HTMLElement>('.booking-dialog .dialog-scroll')?.scrollTo({ top: 0 })
}

function goNextStep() {
  if (validateTimeOnly()) {
    mobileStep.value = 2
    scrollDialogToTop()
  }
}

function goPreviousStep() {
  mobileStep.value = 1
  scrollDialogToTop()
}

function validateTimeOnly() {
  const next: Record<string, string> = {}
  if (!form.machineId) next.machineId = '请选择机台'
  if (!form.startTime || !form.endTime) next.time = '请选择时段'
  if (form.endTime <= form.startTime) next.time = '结束时间必须晚于开始时间'
  if (!Number.isInteger(Number(form.partySize)) || Number(form.partySize) < 1) {
    next.partySize = '人数至少为 1'
  }
  if (Number(form.partySize) > maxPartySize.value) {
    next.partySize = `当前时段最多可约 ${maxPartySize.value} 人`
  }
  localErrors.value = next
  return Object.keys(next).length === 0
}

function openCaptcha() {
  if (!props.open || captchaLoading.value || isSubmitting.value) return
  if (!captchaEnabled) {
    mutation.mutate()
    return
  }
  if (!captchaAppId) {
    toast.error('验证码未配置', { description: '缺少 VITE_CAPTCHA_APP_ID，无法提交预约。' })
    return
  }
  captchaLoading.value = true
}

function onCaptchaVerified(credentials: { ticket: string; randstr: string }) {
  captchaLoading.value = false
  captchaVerified.value = true
  captchaTicket.value = credentials.ticket
  captchaRandstr.value = credentials.randstr
  if (validate()) mutation.mutate()
}

function onCaptchaError(message: string) {
  resetCaptcha()
  toast.error('人机验证未完成', { description: message })
}
const mutation = useMutation({
  mutationFn: () =>
    api.createReservation({
      machineId: form.machineId,
      date: props.date,
      startTime: form.startTime,
      endTime: form.endTime,
      partySize: Number(form.partySize),
      studentId: form.studentId.trim(),
      applicantName: form.applicantName.trim(),
      majorClass: form.majorClass.trim(),
      nickname: form.nickname.trim(),
      qq: form.qq.trim(),
      captchaTicket: captchaTicket.value,
      captchaRandstr: captchaRandstr.value,
      email: form.email.trim(),
      note: form.note.trim(),
    }),
  onSuccess: async () => {
    succeeded.value = true
    failed.value = false
    failureMessage.value = ''
    failureRequestId.value = ''
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['schedule'] }),
      queryClient.invalidateQueries({ queryKey: ['machines'] }),
    ])
    emit('success')
  },
  onError: (error) => {
    failed.value = true
    succeeded.value = false
    failureMessage.value = errorMessage(error)
    failureRequestId.value = error instanceof ApiError ? error.requestId || '' : ''
    serverFields.value = error instanceof ApiError && error.fields ? error.fields : {}
    resetCaptcha()
  },
})

const isSubmitting = computed(() => mutation.isPending.value)
const dateOptions = computed(() =>
  props.dates.map((date) => ({ value: date, label: formatDateLong(date) })),
)
const machineOptions = computed(() =>
  props.schedule.machines.map((machine) => ({
    value: machine.id,
    label: `${machine.name} · ${machine.softwareVersion}`,
  })),
)
const startTimeOptions = computed(() =>
  startOptions.value.map((slot) => ({ value: slot.startTime, label: slot.startTime })),
)
const endTimeOptions = computed(() =>
  endOptions.value.map((end) => ({ value: end, label: end })),
)

function onDateChange(date: string) {
  if (date && date !== props.date) emit('update:date', date)
}
const selectedMachine = computed(() =>
  props.schedule.machines.find((machine) => machine.id === form.machineId),
)

function getCell(machineId: string, startTime: string): ScheduleCell | undefined {
  return props.schedule.cells.find(
    (cell) => cell.machineId === machineId && cell.slotStart === startTime,
  )
}

const startOptions = computed(() => {
  const slots = props.schedule.slots
  if (!form.machineId) return slots
  return slots.filter((slot) => {
    const cell = getCell(form.machineId, slot.startTime)
    return !cell || (cell.state !== 'past' && cell.state !== 'full')
  })
})

const startIndex = computed(() =>
  props.schedule.slots.findIndex((slot) => slot.startTime === form.startTime),
)

const endOptions = computed(() => {
  const start = startIndex.value
  if (start < 0) return []
  return props.schedule.slots.slice(start, start + props.schedule.maxSlots).map((slot) => slot.endTime)
})

const selectedCells = computed(() => {
  const start = startIndex.value
  if (start < 0 || !form.endTime) return []
  const endIndex = props.schedule.slots.findIndex((slot) => slot.endTime === form.endTime)
  if (endIndex < start) return []
  return props.schedule.slots
    .slice(start, endIndex + 1)
    .map((slot) => getCell(form.machineId, slot.startTime))
    .filter((cell): cell is ScheduleCell => Boolean(cell))
})

const remainingMin = computed(() => {
  if (!selectedMachine.value) return 0
  if (selectedCells.value.length === 0) return selectedMachine.value.capacity
  return Math.min(
    ...selectedCells.value.map((cell) =>
      Math.max(0, cell.capacity - cell.approvedPeople - cell.pendingPeople),
    ),
  )
})

const maxPartySize = computed(() =>
  Math.max(1, Math.min(selectedMachine.value?.capacity ?? 1, remainingMin.value)),
)

const errors = computed(() => ({ ...serverFields.value, ...localErrors.value }))
const fieldLabels: Record<string, string> = {
  captcha: '人机验证',
  machineId: '机台',
  time: '预约时段',
  partySize: '人数',
  studentId: '学号',
  applicantName: '姓名',
  majorClass: '专业班级',
  nickname: '昵称',
  qq: 'QQ 号',
  email: '邮箱',
  note: '备注',
}
const failureDetails = computed(() =>
  Object.entries(serverFields.value).map(([field, message]) => ({
    field,
    label: fieldLabels[field] || field,
    message,
  })),
)
const canSubmit = computed(
  () =>
    !isSubmitting.value &&
    !props.dateLoading &&
    props.schedule.date === props.date &&
    !captchaLoading.value &&
    startOptions.value.length > 0 &&
    Boolean(form.startTime) &&
    Boolean(form.endTime) &&
    maxPartySize.value > 0,
)

watch(
  () => props.open,
  (open) => {
    if (!open) {
      captchaLoading.value = false
      stopRulesTimer()
      return
    }
    succeeded.value = false
    failed.value = false
    failureMessage.value = ''
    failureRequestId.value = ''
    step.value = 'form'
    mobileStep.value = 1
    stopRulesTimer()
    rulesRemaining.value = 5
    rulesAccepted.value = false
    localErrors.value = {}
    serverFields.value = {}
    resetCaptcha()
    mutation.reset()
    const machine =
      props.schedule.machines.find((item) => item.id === props.initialMachineId) ??
      props.schedule.machines[0]
    form.machineId = machine?.id ?? ''
    form.startTime = props.initialStartTime || props.schedule.slots[0]?.startTime || ''
    form.endTime =
      props.initialEndTime ||
      props.schedule.slots.find((slot) => slot.startTime === form.startTime)?.endTime ||
      props.schedule.slots[0]?.endTime ||
      ''
    form.partySize = 1
  },
)

watch(
  form,
  () => {
    if (Object.keys(serverFields.value).length) serverFields.value = {}
    if (Object.keys(localErrors.value).length) localErrors.value = {}
  },
  { deep: true },
)

watch(
  () => form.startTime,
  () => {
    if (!form.endTime || form.endTime <= form.startTime) {
      const slot = props.schedule.slots.find((item) => item.startTime === form.startTime)
      form.endTime = slot?.endTime ?? endOptions.value[0] ?? ''
    }
  },
)

watch(
  () => form.machineId,
  () => {
    const options = startOptions.value
    if (!options.some((slot) => slot.startTime === form.startTime)) {
      form.startTime = options[0]?.startTime ?? ''
      form.endTime = options[0]?.endTime ?? ''
    }
  },
)

watch(
  () => props.schedule.date,
  () => {
    if (!props.open) return
    const machine = props.schedule.machines.find((item) => item.id === form.machineId)
    if (!machine) {
      form.machineId = props.schedule.machines[0]?.id ?? ''
      return
    }
    const options = startOptions.value
    if (!options.some((slot) => slot.startTime === form.startTime)) {
      form.startTime = options[0]?.startTime ?? ''
      form.endTime = options[0]?.endTime ?? ''
    }
  },
)

watch(maxPartySize, (max) => {
  if (form.partySize > max) form.partySize = max
})

function validate() {
  const next: Record<string, string> = {}
  if (!form.machineId) next.machineId = '请选择机台'
  if (!form.startTime || !form.endTime) next.time = '请选择时段'
  if (form.endTime <= form.startTime) next.time = '结束时间必须晚于开始时间'
  if (!/^2\d(40|50)\d{6}$/.test(form.studentId.trim())) next.studentId = '不正确的学号'
  if (form.applicantName.trim().length < 1) next.applicantName = '请填写姓名'
  if (form.applicantName.trim().length > 40) next.applicantName = '姓名不能超过 40 个字符'
  if (form.majorClass.trim().length < 1) next.majorClass = '请填写专业班级'
  if (form.majorClass.trim().length > 60) next.majorClass = '专业班级不能超过 60 个字符'
  if (form.nickname.trim().length < 1) next.nickname = '请填写昵称'
  if (form.nickname.trim().length > 20) next.nickname = '昵称不能超过 20 个字符'
  if (!/^[1-9][0-9]{4,11}$/.test(form.qq.trim())) next.qq = '请填写 5–12 位 QQ 号'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = '请填写有效邮箱'
  if (!Number.isInteger(Number(form.partySize)) || Number(form.partySize) < 1) {
    next.partySize = '人数至少为 1'
  }
  if (Number(form.partySize) > maxPartySize.value) {
    next.partySize = `当前时段最多可约 ${maxPartySize.value} 人`
  }
  if (form.note.length > 500) next.note = '备注不能超过 500 个字符'
  localErrors.value = next
  return Object.keys(next).length === 0
}

function submit() {
  if (!canSubmit.value) return
  serverFields.value = {}
  if (!validate()) return
  if (captchaEnabled && !captchaVerified.value) {
    if (!rulesAccepted.value) {
      step.value = 'rules'
      startRulesTimer()
      scrollDialogToTop()
      return
    }
    openCaptcha()
    return
  }
  mutation.mutate()
}

function close() {
  if (isSubmitting.value || captchaLoading.value) return
  stopRulesTimer()
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    v-if="!captchaLoading"
    :open="props.open"
    :title="
      succeeded ? '预约成功' : failed ? '预约失败' : step === 'rules' ? '预约前请阅读' : '预约机台'
    "
    :description="
      succeeded
        ? '审批结果会发送到你的邮箱，可使用学号查询预约状态。'
        : failed
          ? '预约没有提交成功，请查看失败原因。'
          : step === 'rules'
            ? '倒计时结束后才能继续人机验证。'
            : '选择机台与连续时段，填写信息后提交审批。'
    "
    :persistent="isSubmitting || captchaLoading"
    fullscreen
    class="booking-dialog max-w-2xl"
    @update:open="emit('update:open', $event)"
  >
    <template v-if="failed">
      <div class="py-3">
        <div class="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10">
          <AlertCircle class="size-6 text-destructive" />
        </div>
        <p class="mt-3 text-center text-base font-medium text-foreground">预约没有提交成功</p>
        <p class="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm leading-relaxed text-destructive">
          {{ failureMessage }}
        </p>
        <ul v-if="failureDetails.length > 1" class="mt-3 space-y-1.5 rounded-lg border border-border px-3 py-2.5">
          <li v-for="item in failureDetails" :key="item.field" class="text-sm text-muted-foreground">
            <span class="font-medium text-foreground">{{ item.label }}</span>：{{ item.message }}
          </li>
        </ul>
        <p v-if="failureRequestId" class="mt-3 break-all text-center text-[11px] text-muted-foreground">
          请求 ID：{{ failureRequestId }}
        </p>
        <p class="mt-3 text-center text-xs text-muted-foreground">返回修改信息后可以重新提交。</p>
      </div>
    </template>

    <template v-else-if="!succeeded && step === 'form'">
      <div class="mb-5 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
        <CalendarDays class="size-4 shrink-0 text-primary" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-foreground">{{ formatDateLong(props.date) }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ props.schedule.openTime }}–{{ props.schedule.closeTime }}
          </p>
        </div>
        <Badge variant="warning" class="ml-auto shrink-0">待审批</Badge>
      </div>

      <div
        v-if="startOptions.length === 0"
        class="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
      >
        当前机台在该日期已没有可预约时段，请选择其他机台或日期。
      </div>

      <div v-if="isMobile" class="mb-4 flex items-center gap-2 text-xs">
        <span
          class="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium"
          :class="mobileStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
        >
          1 预约时间
        </span>
        <span class="h-px flex-1 bg-border" />
        <span
          class="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium"
          :class="mobileStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
        >
          2 预约人信息
        </span>
      </div>

      <div v-show="!isMobile || mobileStep === 1" class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2 sm:col-span-2">
          <Label for="booking-date">日期</Label>
          <Select
            id="booking-date"
            :model-value="props.date"
            :options="dateOptions"
            aria-label="预约日期"
            @update:model-value="onDateChange"
          />
          <p v-if="props.dateLoading || props.schedule.date !== props.date" class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LoaderCircle class="size-3 animate-spin" />正在加载该日期的可约时段…
          </p>
        </div>

        <div class="space-y-2">
          <Label for="booking-machine">机台</Label>
          <Select id="booking-machine" v-model="form.machineId" :options="machineOptions" />
          <p v-if="errors.machineId" class="text-xs text-destructive">{{ errors.machineId }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-party">人数</Label>
          <div class="flex items-center gap-2">
            <Input
              id="booking-party"
              v-model.number="form.partySize"
              type="number"
              inputmode="numeric"
              min="1"
              :max="maxPartySize"
              class="number-tabular"
            />
            <span class="shrink-0 text-xs text-muted-foreground">最多 {{ maxPartySize }} 人</span>
          </div>
          <p v-if="errors.partySize" class="text-xs text-destructive">{{ errors.partySize }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-start">开始时间</Label>
          <Select id="booking-start" v-model="form.startTime" :options="startTimeOptions" />
        </div>

        <div class="space-y-2">
          <Label for="booking-end">结束时间</Label>
          <Select id="booking-end" v-model="form.endTime" :options="endTimeOptions" />
          <p v-if="errors.time" class="text-xs text-destructive">{{ errors.time }}</p>
        </div>
      </div>

      <div v-show="!isMobile || mobileStep === 2" class="grid gap-4 sm:mt-4 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="booking-student-id">学号</Label>
          <Input
            id="booking-student-id"
            v-model="form.studentId"
            inputmode="numeric"
            maxlength="10"
            placeholder="2x40xxxxxx"
            class="font-mono tracking-wide"
            autocomplete="off"
          />
          <p class="text-[11px] text-muted-foreground">10 位：入学年份 + 40/50 + 6 位序号，仅在校生可预约</p>
          <p v-if="errors.studentId" class="text-xs text-destructive">{{ errors.studentId }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-name">姓名</Label>
          <Input id="booking-name" v-model="form.applicantName" maxlength="40" placeholder="真实姓名" autocomplete="name" />
          <p v-if="errors.applicantName" class="text-xs text-destructive">{{ errors.applicantName }}</p>
        </div>

        <div class="space-y-2 sm:col-span-2">
          <Label for="booking-major">专业班级</Label>
          <Input id="booking-major" v-model="form.majorClass" maxlength="60" placeholder="例如：计算机 2301" />
          <p v-if="errors.majorClass" class="text-xs text-destructive">{{ errors.majorClass }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-nickname">昵称</Label>
          <Input id="booking-nickname" v-model="form.nickname" maxlength="20" placeholder="展示在预约信息中" autocomplete="nickname" />
          <p v-if="errors.nickname" class="text-xs text-destructive">{{ errors.nickname }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-qq">QQ 号</Label>
          <Input
            id="booking-qq"
            v-model="form.qq"
            inputmode="numeric"
            maxlength="12"
            placeholder="5–12 位数字"
            autocomplete="off"
          />
          <p v-if="errors.qq" class="text-xs text-destructive">{{ errors.qq }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-email">邮箱</Label>
          <Input id="booking-email" v-model="form.email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" :spellcheck="false" maxlength="254" placeholder="用于接收审批结果" />
          <p v-if="errors.email" class="text-xs text-destructive">{{ errors.email }}</p>
        </div>

        <div class="space-y-2 sm:col-span-2">
          <Label for="booking-note">备注 <span class="font-normal text-muted-foreground">（选填）</span></Label>
          <Textarea
            id="booking-note"
            v-model="form.note"
            maxlength="500"
            placeholder="如有特殊需求可以在这里说明"
          />
          <div class="flex justify-between gap-2">
            <p v-if="errors.note" class="text-xs text-destructive">{{ errors.note }}</p>
            <span class="ml-auto text-[11px] text-muted-foreground">{{ form.note.length }}/500</span>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span class="flex items-center gap-1.5">
          <Clock3 class="size-3.5" />{{ form.startTime || '—' }}–{{ form.endTime || '—' }}
        </span>
        <span class="flex items-center gap-1.5">
          <Users class="size-3.5" />剩余约 {{ remainingMin }} 个名额
        </span>
        <span class="flex items-center gap-1.5">
          <Mail class="size-3.5" />审批结果发送到邮箱
        </span>
      </div>
    </template>

    <template v-else-if="step === 'rules'">
      <div class="rules-markdown" v-html="rulesHtml" />
    </template>

    <template v-else>
      <div class="py-2 text-center">
        <CheckCircle2 class="mx-auto size-10 text-success" />
        <p class="mt-3 text-sm font-medium text-foreground">预约已提交，等待管理员审批</p>
        <p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
          审批结果会发送到
          <span class="text-foreground">{{ form.email }}</span>。
          之后可以凭学号在「查询预约」查看状态，无需保存预约码。
        </p>
      </div>
    </template>

    <template #footer>
      <template v-if="failed">
        <Button variant="ghost" class="w-full sm:w-auto" :disabled="isSubmitting" @click="close">
          关闭
        </Button>
        <Button class="w-full sm:w-auto" @click="failed = false; step = 'form'">返回修改</Button>
      </template>
      <template v-else-if="!succeeded && step === 'form'">
        <Button
          v-if="!isMobile || mobileStep === 1"
          variant="ghost"
          class="w-full sm:w-auto"
          :disabled="isSubmitting"
          @click="close"
        >
          取消
        </Button>
        <Button v-if="isMobile && mobileStep === 1" class="w-full sm:w-auto" :disabled="!canSubmit" @click="goNextStep">
          下一步
        </Button>
        <template v-else>
          <Button v-if="isMobile" variant="ghost" class="w-full sm:w-auto" :disabled="isSubmitting" @click="goPreviousStep">
            上一步
          </Button>
          <Button class="w-full sm:w-auto" :disabled="!canSubmit" @click="submit">
            <LoaderCircle v-if="isSubmitting" class="animate-spin" />
            提交审批
          </Button>
        </template>
      </template>
      <template v-else-if="step === 'rules'">
        <Button variant="ghost" class="w-full sm:w-auto" @click="step = 'form'; stopRulesTimer()">
          返回修改
        </Button>
        <Button class="w-full sm:w-auto" :disabled="rulesRemaining > 0" @click="onRulesAccepted">
          {{ rulesRemaining > 0 ? `请阅读规则（${rulesRemaining}s）` : '我已阅读，继续验证' }}
        </Button>
      </template>
      <Button v-else class="w-full sm:w-auto" @click="close">完成</Button>
    </template>
  </Dialog>
  <TencentCaptchaChallenge
    v-if="props.open && captchaLoading"
    :app-id="captchaAppId"
    @verified="onCaptchaVerified"
    @cancel="resetCaptcha"
    @error="onCaptchaError"
  />
</template>


<style scoped>
.rules-markdown {
  overflow-wrap: anywhere;
  padding-right: 0.25rem;
  color: var(--color-muted-foreground);
  font-size: 0.875rem;
  line-height: 1.8;
}

.rules-markdown :deep(h1) {
  margin: 0 0 0.75rem;
  color: var(--color-foreground);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.35;
}

.rules-markdown :deep(h2) {
  margin: 1.25rem 0 0.5rem;
  color: var(--color-foreground);
  font-size: 1rem;
  font-weight: 600;
}

.rules-markdown :deep(h3) {
  margin: 1rem 0 0.375rem;
  color: var(--color-foreground);
  font-size: 0.9375rem;
  font-weight: 600;
}

.rules-markdown :deep(p) {
  margin: 0.5rem 0;
}

.rules-markdown :deep(ul),
.rules-markdown :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.rules-markdown :deep(ul) {
  list-style: disc;
}

.rules-markdown :deep(ol) {
  list-style: decimal;
}

.rules-markdown :deep(li) {
  margin: 0.25rem 0;
}

.rules-markdown :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rules-markdown :deep(strong) {
  color: var(--color-foreground);
  font-weight: 600;
}

.rules-markdown :deep(blockquote) {
  margin: 0.75rem 0;
  border-left: 3px solid var(--color-border);
  padding-left: 0.75rem;
  color: var(--color-muted-foreground);
}

.rules-markdown :deep(code) {
  border-radius: 0.25rem;
  background: var(--color-muted);
  padding: 0.125rem 0.3rem;
  font-size: 0.8125rem;
}

.rules-markdown :deep(hr) {
  margin: 1rem 0;
  border-color: var(--color-border);
}
</style>
