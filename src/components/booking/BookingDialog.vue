<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import RulesDialog from '@/components/booking/RulesDialog.vue'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, errorMessage } from '@/lib/api/client'
import type { Schedule, ScheduleCell } from '@/lib/api/types'
import { formatDateLong } from '@/lib/date'
import bookingRules from '@/content/booking-rules.md?raw'

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
  email: '',
  note: '',
})
const localErrors = ref<Record<string, string>>({})
const serverFields = ref<Record<string, string>>({})
const succeeded = ref(false)

const captchaAppId = String(import.meta.env.VITE_CAPTCHA_APP_ID || '')
const captchaEnabled = import.meta.env.VITE_CAPTCHA_ENABLED
  ? import.meta.env.VITE_CAPTCHA_ENABLED !== 'false'
  : import.meta.env.PROD
const captchaVerified = ref(false)
const captchaLoading = ref(false)
const captchaError = ref('')
const captchaTicket = ref('')
const captchaRandstr = ref('')
const rulesOpen = ref(false)
const rulesAccepted = ref(false)

let captchaScriptPromise: Promise<void> | null = null

type TencentCaptchaResult = {
  ret: number
  ticket?: string | null
  randstr?: string | null
  errorCode?: number
  errorMessage?: string
}

type TencentCaptchaCtor = new (
  appId: string,
  callback: (result: TencentCaptchaResult) => void,
  options?: Record<string, unknown>,
) => { show: () => void; destroy: () => void }

function loadCaptchaScript(): Promise<void> {
  const existing = (window as unknown as { TencentCaptcha?: TencentCaptchaCtor }).TencentCaptcha
  if (existing) return Promise.resolve()
  if (captchaScriptPromise) return captchaScriptPromise

  captchaScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://turing.captcha.qcloud.com/TCaptcha.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      captchaScriptPromise = null
      reject(new Error('captcha script failed to load'))
    }
    document.head.appendChild(script)
  })
  return captchaScriptPromise
}

function resetCaptcha() {
  captchaVerified.value = false
  captchaTicket.value = ''
  captchaRandstr.value = ''
  captchaLoading.value = false
}

function requestCaptcha() {
  if (!captchaEnabled) return
  if (!rulesAccepted.value) {
    rulesOpen.value = true
    return
  }
  openCaptcha()
}

function onRulesAccepted() {
  rulesAccepted.value = true
  window.setTimeout(() => openCaptcha(), 120)
}

function openCaptcha() {
  captchaError.value = ''
  if (!captchaEnabled) return
  if (!captchaAppId) {
    captchaError.value = '未配置验证码 AppID，无法提交预约'
    return
  }
  captchaLoading.value = true
  void loadCaptchaScript()
    .then(() => {
      const Ctor = (window as unknown as { TencentCaptcha?: TencentCaptchaCtor }).TencentCaptcha
      if (!Ctor) throw new Error('TencentCaptcha is unavailable')
      const instance = new Ctor(captchaAppId, (result) => {
        captchaLoading.value = false
        if (result.ret === 0 && result.ticket && result.randstr && !result.errorCode) {
          captchaVerified.value = true
          captchaTicket.value = result.ticket
          captchaRandstr.value = result.randstr
          captchaError.value = ''
          toast.success('人机验证通过')
          return
        }
        if (result.ret !== 2) {
          captchaError.value = result.errorMessage || '验证未通过，请重试'
        }
      }, { userLanguage: 'zh-cn' })
      instance.show()
    })
    .catch(() => {
      captchaLoading.value = false
      captchaError.value = '验证码加载失败，请检查网络后重试'
    })
}

const captchaReady = computed(() => !captchaEnabled || captchaVerified.value)


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
      captchaTicket: captchaTicket.value,
      captchaRandstr: captchaRandstr.value,
      email: form.email.trim(),
      note: form.note.trim(),
    }),
  onSuccess: async () => {
    succeeded.value = true
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['schedule'] }),
      queryClient.invalidateQueries({ queryKey: ['machines'] }),
    ])
    emit('success')
    toast.success('预约已提交', { description: '管理员审批后会向你的邮箱发送结果。' })
  },
  onError: (error) => {
    if (error instanceof ApiError && error.fields) {
      serverFields.value = error.fields
    }
    resetCaptcha()
    toast.error('预约没有提交成功', { description: errorMessage(error) })
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
const canSubmit = computed(
  () =>
    !isSubmitting.value &&
    !props.dateLoading &&
    props.schedule.date === props.date &&
    captchaReady.value &&
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
      rulesOpen.value = false
      return
    }
    succeeded.value = false
    rulesOpen.value = false
    rulesAccepted.value = false
    localErrors.value = {}
    serverFields.value = {}
    captchaError.value = ''
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
  if (captchaEnabled && !captchaVerified.value) next.captcha = '请先完成人机验证'
  if (!/^2\d(40|50)\d{6}$/.test(form.studentId.trim())) next.studentId = '不正确的学号'
  if (form.applicantName.trim().length < 1) next.applicantName = '请填写姓名'
  if (form.applicantName.trim().length > 40) next.applicantName = '姓名不能超过 40 个字符'
  if (form.majorClass.trim().length < 1) next.majorClass = '请填写专业班级'
  if (form.majorClass.trim().length > 60) next.majorClass = '专业班级不能超过 60 个字符'
  if (form.nickname.trim().length < 1) next.nickname = '请填写昵称'
  if (form.nickname.trim().length > 20) next.nickname = '昵称不能超过 20 个字符'
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
  serverFields.value = {}
  if (!validate()) return
  mutation.mutate()
}

function close() {
  if (isSubmitting.value) return
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :open="props.open"
    :title="succeeded ? '预约已提交' : '预约机台'"
    :description="
      succeeded
        ? '审批结果会发送到你的邮箱，可使用学号查询预约状态。'
        : '选择机台与连续时段，填写信息后提交审批。'
    "
    :persistent="isSubmitting"
    class="max-w-2xl"
    @update:open="emit('update:open', $event)"
  >
    <template v-if="!succeeded">
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

      <div class="grid gap-4 sm:grid-cols-2">
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
          <Input id="booking-name" v-model="form.applicantName" maxlength="40" placeholder="真实姓名" />
          <p v-if="errors.applicantName" class="text-xs text-destructive">{{ errors.applicantName }}</p>
        </div>

        <div class="space-y-2 sm:col-span-2">
          <Label for="booking-major">专业班级</Label>
          <Input id="booking-major" v-model="form.majorClass" maxlength="60" placeholder="例如：计算机 2301" />
          <p v-if="errors.majorClass" class="text-xs text-destructive">{{ errors.majorClass }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-nickname">昵称</Label>
          <Input id="booking-nickname" v-model="form.nickname" maxlength="20" placeholder="展示在预约信息中" />
          <p v-if="errors.nickname" class="text-xs text-destructive">{{ errors.nickname }}</p>
        </div>

        <div class="space-y-2">
          <Label for="booking-email">邮箱</Label>
          <Input id="booking-email" v-model="form.email" type="email" maxlength="254" placeholder="用于接收审批结果" />
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

        <div v-if="captchaEnabled" class="space-y-2 sm:col-span-2">
          <div class="rounded-lg border border-border bg-muted/30 px-3 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <ShieldCheck class="size-4 text-primary" />
                  人机验证
                </p>
                <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                  提交预约前需要完成腾讯云验证码，防止机器批量预约。
                </p>
              </div>
              <Badge v-if="captchaVerified" variant="success" class="shrink-0">已验证</Badge>
              <Button
                v-else
                type="button"
                variant="outline"
                size="sm"
                class="shrink-0"
                :disabled="captchaLoading"
                @click="requestCaptcha"
              >
                <LoaderCircle v-if="captchaLoading" class="animate-spin" />
                <ShieldCheck v-else class="size-4" />
                开始验证
              </Button>
            </div>
            <p v-if="captchaError" class="mt-2 text-xs text-destructive">{{ captchaError }}</p>
            <p v-else-if="!captchaAppId" class="mt-2 text-xs text-destructive">
              未配置 VITE_CAPTCHA_APP_ID，无法提交预约。
            </p>
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
      <template v-if="!succeeded">
        <Button variant="ghost" class="w-full sm:w-auto" :disabled="isSubmitting" @click="close">
          取消
        </Button>
        <Button class="w-full sm:w-auto" :disabled="!canSubmit" @click="submit">
          <LoaderCircle v-if="isSubmitting" class="animate-spin" />
          提交审批
        </Button>
      </template>
      <Button v-else class="w-full sm:w-auto" @click="close">完成</Button>
    </template>
  </Dialog>

  <RulesDialog v-model:open="rulesOpen" :markdown="bookingRules" @accept="onRulesAccepted" />
</template>
