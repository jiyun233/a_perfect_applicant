<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { Gamepad2, LoaderCircle, Pause, Play, Save, WifiOff } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, errorMessage } from '@/lib/api/client'
import type { Machine, MachineState } from '@/lib/api/types'

const props = defineProps<{
  open: boolean
  machine: Machine | null
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const queryClient = useQueryClient()
const serverErrors = ref<Record<string, string>>({})
const localErrors = ref<Record<string, string>>({})
const form = reactive({
  state: 'idle' as MachineState,
  currentPlayers: 0,
  currentSong: '',
  currentChart: '',
  note: '',
})

const stateOptions: { value: MachineState; label: string; description: string; icon: typeof Play }[] = [
  { value: 'playing', label: '游玩中', description: '有人正在游玩', icon: Play },
  { value: 'idle', label: '空闲', description: '可正常游玩', icon: Pause },
  { value: 'offline', label: '离线', description: '维护或暂停使用', icon: WifiOff },
]

const errors = computed(() => ({ ...serverErrors.value, ...localErrors.value }))
const maxPlayers = computed(() => props.machine?.capacity ?? 1)

const mutation = useMutation({
  mutationFn: () => {
    if (!props.machine) throw new Error('missing machine')
    return api.adminUpdateMachineStatus(props.machine.id, {
      state: form.state,
      currentPlayers: form.state === 'playing' ? Number(form.currentPlayers) : 0,
      currentSong: form.currentSong.trim(),
      currentChart: form.currentChart.trim(),
      note: form.note.trim(),
    })
  },
  onSuccess: async () => {
    toast.success('机台状态已更新')
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-machines'] }),
      queryClient.invalidateQueries({ queryKey: ['machines'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ])
    emit('saved')
    emit('update:open', false)
  },
  onError: (error) => {
    if (error instanceof ApiError && error.fields) {
      serverErrors.value = error.fields
    }
    toast.error('状态更新失败', { description: errorMessage(error) })
  },
})

watch(
  () => props.open,
  (open) => {
    if (!open || !props.machine) return
    serverErrors.value = {}
    localErrors.value = {}
    mutation.reset()
    form.state = props.machine.status.state
    form.currentPlayers = props.machine.status.currentPlayers
    form.currentSong = props.machine.status.currentSong
    form.currentChart = props.machine.status.currentChart
    form.note = props.machine.status.note
  },
)

watch(
  () => form.state,
  (state) => {
    if (state !== 'playing') form.currentPlayers = 0
  },
)

function validate() {
  const next: Record<string, string> = {}
  if (form.state === 'playing' && Number(form.currentPlayers) < 0) {
    next.currentPlayers = '人数不能为负数'
  }
  if (form.state === 'playing' && Number(form.currentPlayers) > maxPlayers.value) {
    next.currentPlayers = `不能超过机台容量 ${maxPlayers.value}`
  }
  localErrors.value = next
  return Object.keys(next).length === 0
}

function submit() {
  serverErrors.value = {}
  if (!validate()) return
  mutation.mutate()
}

function close(value: boolean) {
  if (!value && mutation.isPending.value) return
  emit('update:open', value)
}
</script>

<template>
  <Dialog
    :open="props.open"
    title="维护机台状态"
    :description="props.machine ? `${props.machine.name} · ${props.machine.softwareVersion || '未设置版本'}` : ''"
    :persistent="mutation.isPending.value"
    @update:open="close"
  >
    <div v-if="props.machine" class="space-y-5">
      <div class="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
        <Gamepad2 class="size-5 text-muted-foreground" />
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-foreground">{{ props.machine.name }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">容量 {{ props.machine.capacity }} 人 · 版本 {{ props.machine.softwareVersion || '—' }}</p>
        </div>
      </div>

      <div class="grid gap-2 sm:grid-cols-3">
        <button
          v-for="option in stateOptions"
          :key="option.value"
          type="button"
          class="rounded-lg border px-3 py-3 text-left transition-colors"
          :class="
            form.state === option.value
              ? 'border-primary bg-primary/5'
              : 'border-border hover:bg-muted'
          "
          @click="form.state = option.value"
        >
          <component :is="option.icon" class="size-4" :class="form.state === option.value ? 'text-primary' : 'text-muted-foreground'" />
          <p class="mt-2 text-sm font-medium text-foreground">{{ option.label }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ option.description }}</p>
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="status-players">当前人数</Label>
          <Input
            id="status-players"
            v-model.number="form.currentPlayers"
            type="number"
            min="0"
            :max="maxPlayers"
            :disabled="form.state !== 'playing'"
          />
          <p v-if="errors.currentPlayers" class="text-xs text-destructive">{{ errors.currentPlayers }}</p>
        </div>
        <div class="space-y-2">
          <Label for="status-chart">当前难度 <span class="font-normal text-muted-foreground">（选填）</span></Label>
          <Input id="status-chart" v-model="form.currentChart" maxlength="60" :disabled="form.state !== 'playing'" placeholder="EXPERT 13" />
          <p v-if="errors.currentChart" class="text-xs text-destructive">{{ errors.currentChart }}</p>
        </div>
        <div class="space-y-2 sm:col-span-2">
          <Label for="status-song">当前曲目 <span class="font-normal text-muted-foreground">（选填）</span></Label>
          <Input id="status-song" v-model="form.currentSong" maxlength="100" :disabled="form.state !== 'playing'" placeholder="游玩中显示在成员端" />
          <p v-if="errors.currentSong" class="text-xs text-destructive">{{ errors.currentSong }}</p>
        </div>
        <div class="space-y-2 sm:col-span-2">
          <Label for="status-note">状态备注 <span class="font-normal text-muted-foreground">（选填）</span></Label>
          <Textarea id="status-note" v-model="form.note" maxlength="200" placeholder="例如维护中，预计 18:00 恢复" />
          <p v-if="errors.note" class="text-xs text-destructive">{{ errors.note }}</p>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" class="w-full sm:w-auto" :disabled="mutation.isPending.value" @click="close(false)">取消</Button>
      <Button class="w-full sm:w-auto" :disabled="mutation.isPending.value || !props.machine" @click="submit">
        <LoaderCircle v-if="mutation.isPending.value" class="animate-spin" />
        <Save v-else class="size-4" />
        保存
      </Button>
    </template>
  </Dialog>
</template>
