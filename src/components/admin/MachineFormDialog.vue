<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { LoaderCircle, Save } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError, errorMessage } from '@/lib/api/client'
import type { Machine, MachineInput } from '@/lib/api/types'

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

const emptyForm = (): MachineInput => ({
  code: '',
  name: '',
  game: '',
  cabinetModel: '',
  softwareVersion: '',
  location: '',
  capacity: 2,
  sortOrder: 0,
  active: true,
  notes: '',
})
const form = reactive<MachineInput>(emptyForm())

const isEditing = computed(() => Boolean(props.machine))
const errors = computed(() => ({ ...serverErrors.value, ...localErrors.value }))

const mutation = useMutation({
  mutationFn: () => {
    const payload: MachineInput = {
      ...form,
      capacity: Number(form.capacity),
      sortOrder: Number(form.sortOrder),
    }
    return props.machine
      ? api.adminUpdateMachine(props.machine.id, payload)
      : api.adminCreateMachine(payload)
  },
  onSuccess: async () => {
    toast.success(isEditing.value ? '机台信息已更新' : '机台已创建')
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-machines'] }),
      queryClient.invalidateQueries({ queryKey: ['machines'] }),
      queryClient.invalidateQueries({ queryKey: ['schedule'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ])
    emit('saved')
    emit('update:open', false)
  },
  onError: (error) => {
    if (error instanceof ApiError && error.fields) {
      serverErrors.value = error.fields
    }
    toast.error('保存失败', { description: errorMessage(error) })
  },
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    serverErrors.value = {}
    localErrors.value = {}
    mutation.reset()
    if (props.machine) {
      Object.assign(form, {
        code: props.machine.code,
        name: props.machine.name,
        game: props.machine.game,
        cabinetModel: props.machine.cabinetModel,
        softwareVersion: props.machine.softwareVersion,
        location: props.machine.location,
        capacity: props.machine.capacity,
        sortOrder: props.machine.sortOrder,
        active: props.machine.active,
        notes: props.machine.notes,
      })
    } else {
      Object.assign(form, emptyForm())
    }
  },
)

function validate() {
  const next: Record<string, string> = {}
  if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(form.code)) next.code = '2–32 位小写字母、数字或连字符'
  if (!form.name.trim()) next.name = '请填写机台名称'
  if (!form.game.trim()) next.game = '请填写游戏名称'
  if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1 || Number(form.capacity) > 20) {
    next.capacity = '容量需在 1–20 之间'
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
    :title="isEditing ? '编辑机台' : '新增机台'"
    :description="isEditing ? '修改机台信息或启用状态。' : '登记一台实验室机台。'"
    :persistent="mutation.isPending.value"
    class="max-w-2xl"
    @update:open="close"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <Label for="machine-code">机台编号</Label>
        <Input id="machine-code" v-model="form.code" placeholder="mai-01" class="font-mono" />
        <p class="text-xs text-muted-foreground">小写字母、数字或连字符</p>
        <p v-if="errors.code" class="text-xs text-destructive">{{ errors.code }}</p>
      </div>
      <div class="space-y-2">
        <Label for="machine-name">机台名称</Label>
        <Input id="machine-name" v-model="form.name" placeholder="maimai DX" />
        <p v-if="errors.name" class="text-xs text-destructive">{{ errors.name }}</p>
      </div>
      <div class="space-y-2">
        <Label for="machine-game">游戏</Label>
        <Input id="machine-game" v-model="form.game" placeholder="maimai DX" />
        <p v-if="errors.game" class="text-xs text-destructive">{{ errors.game }}</p>
      </div>
      <div class="space-y-2">
        <Label for="machine-version">当前版本</Label>
        <Input id="machine-version" v-model="form.softwareVersion" placeholder="PRiSM PLUS" />
        <p v-if="errors.softwareVersion" class="text-xs text-destructive">{{ errors.softwareVersion }}</p>
      </div>
      <div class="space-y-2">
        <Label for="machine-model">机台型号</Label>
        <Input id="machine-model" v-model="form.cabinetModel" placeholder="maimai DX Cabinet" />
        <p v-if="errors.cabinetModel" class="text-xs text-destructive">{{ errors.cabinetModel }}</p>
      </div>
      <div class="space-y-2">
        <Label for="machine-location">位置</Label>
        <Input id="machine-location" v-model="form.location" placeholder="A 区 · 1 号机" />
        <p v-if="errors.location" class="text-xs text-destructive">{{ errors.location }}</p>
      </div>
      <div class="space-y-2">
        <Label for="machine-capacity">每时段容量</Label>
        <Input id="machine-capacity" v-model.number="form.capacity" type="number" min="1" max="20" />
        <p v-if="errors.capacity" class="text-xs text-destructive">{{ errors.capacity }}</p>
      </div>
      <div class="space-y-2">
        <Label for="machine-sort">排序</Label>
        <Input id="machine-sort" v-model.number="form.sortOrder" type="number" min="0" max="9999" />
        <p v-if="errors.sortOrder" class="text-xs text-destructive">{{ errors.sortOrder }}</p>
      </div>
      <div class="space-y-2 sm:col-span-2">
        <Label for="machine-notes">备注 <span class="font-normal text-muted-foreground">（成员端可见，选填）</span></Label>
        <Textarea id="machine-notes" v-model="form.notes" maxlength="500" placeholder="例如维护提示" />
        <p v-if="errors.notes" class="text-xs text-destructive">{{ errors.notes }}</p>
      </div>
      <button
        type="button"
        class="flex items-center justify-between rounded-lg border border-border px-3 py-3 text-left sm:col-span-2"
        @click="form.active = !form.active"
      >
        <span class="text-sm font-medium text-foreground">{{ form.active ? '机台启用中' : '机台已停用' }}</span>
        <span
          class="relative h-6 w-10 rounded-full transition-colors"
          :class="form.active ? 'bg-primary' : 'bg-muted'"
        >
          <span
            class="absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-transform"
            :class="form.active ? 'translate-x-[18px]' : 'translate-x-0.5'"
          />
        </span>
      </button>
    </div>

    <template #footer>
      <Button variant="ghost" class="w-full sm:w-auto" :disabled="mutation.isPending.value" @click="close(false)">取消</Button>
      <Button class="w-full sm:w-auto" :disabled="mutation.isPending.value" @click="submit">
        <LoaderCircle v-if="mutation.isPending.value" class="animate-spin" />
        <Save v-else class="size-4" />
        {{ isEditing ? '保存' : '创建' }}
      </Button>
    </template>
  </Dialog>
</template>
