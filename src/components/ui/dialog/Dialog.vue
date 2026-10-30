<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    class?: HTMLAttributes['class']
    persistent?: boolean
    fullscreen?: boolean
  }>(),
  { persistent: false, fullscreen: false },
)
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function handleOpenChange(value: boolean) {
  if (!value && props.persistent) return
  emit('update:open', value)
}

function blockDismiss(event: Event) {
  if (props.persistent) event.preventDefault()
}
</script>

<template>
  <DialogRoot :open="props.open" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay fixed inset-0 z-50 bg-black/40" />
      <DialogContent
        :class="
          cn(
            'dialog-content fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl focus:outline-none',
            props.fullscreen
              ? 'max-sm:inset-0 max-sm:top-0 max-sm:bottom-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:p-4 max-sm:pt-[max(1rem,env(safe-area-inset-top))]'
              : 'max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:max-h-[92dvh] max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]',
            props.class,
          )
        "
        @pointer-down-outside="blockDismiss"
        @escape-key-down="blockDismiss"
      >
        <div v-if="!props.fullscreen" class="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <div class="mb-5 pr-8">
          <DialogTitle class="text-lg font-semibold text-foreground">
            {{ props.title }}
          </DialogTitle>
          <DialogDescription v-if="props.description" class="mt-1 text-sm leading-relaxed text-muted-foreground">
            {{ props.description }}
          </DialogDescription>
        </div>
        <slot />
        <div v-if="$slots.footer" class="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-2 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-6 sm:flex-row sm:justify-end">
          <slot name="footer" />
        </div>
        <DialogClose
          class="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="关闭"
        >
          <X class="size-4" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
