<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
    loading?: boolean
  }>(),
  {
    confirmLabel: '确认',
    cancelLabel: '返回',
    destructive: false,
    loading: false,
  },
)
const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Dialog
    :open="props.open"
    :title="props.title"
    :description="props.description"
    :persistent="props.loading"
    @update:open="emit('update:open', $event)"
  >
    <template #footer>
      <Button variant="ghost" class="w-full sm:w-auto" :disabled="props.loading" @click="emit('update:open', false)">
        {{ props.cancelLabel }}
      </Button>
      <Button
        class="w-full sm:w-auto"
        :variant="props.destructive ? 'destructive' : 'default'"
        :disabled="props.loading"
        @click="emit('confirm')"
      >
        <LoaderCircle v-if="props.loading" class="animate-spin" />
        {{ props.confirmLabel }}
      </Button>
    </template>
  </Dialog>
</template>
