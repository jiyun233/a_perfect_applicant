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
import { ref, watch, type HTMLAttributes } from 'vue'
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

const viewportStyle = ref<Record<string, string>>({})
watch(() => props.open, (open, _, onCleanup) => {
  if (!open) return
  const viewport = window.visualViewport
  const updateViewport = () => {
    viewportStyle.value = {
      '--dialog-viewport-height': `${viewport?.height ?? window.innerHeight}px`,
      '--dialog-viewport-top': `${viewport?.offsetTop ?? 0}px`,
    }
  }
  updateViewport()
  viewport?.addEventListener('resize', updateViewport)
  viewport?.addEventListener('scroll', updateViewport)
  window.addEventListener('resize', updateViewport)
  onCleanup(() => {
    viewport?.removeEventListener('resize', updateViewport)
    viewport?.removeEventListener('scroll', updateViewport)
    window.removeEventListener('resize', updateViewport)
  })
}, { immediate: true })

function handleAutoFocus(event: Event) {
  // Opening a mobile sheet should not immediately summon the software keyboard.
  if (window.matchMedia('(pointer: coarse), (max-width: 639px)').matches) {
    event.preventDefault()
    if (event.target instanceof HTMLElement) event.target.focus({ preventScroll: true })
  }
}
</script>

<template>
  <DialogRoot :open="props.open" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay fixed inset-0 z-50 bg-black/40" />
      <DialogContent
        :style="viewportStyle"
        :data-fullscreen="props.fullscreen"
        :class="
          cn(
            'dialog-content fixed left-1/2 top-1/2 z-50 flex min-h-0 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl focus:outline-none',
            props.fullscreen
              ? 'max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0'
              : 'max-sm:inset-x-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl',
            props.class,
          )
        "
        @pointer-down-outside="blockDismiss"
        @escape-key-down="blockDismiss"
        @open-auto-focus="handleAutoFocus"
      >
        <div v-if="!props.fullscreen" class="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <div class="dialog-heading shrink-0 px-4 pb-4 pr-16 pt-5 sm:px-6 sm:pr-16">
          <DialogTitle class="text-lg font-semibold text-foreground">
            {{ props.title }}
          </DialogTitle>
          <DialogDescription v-if="props.description" class="mt-1 text-sm leading-relaxed text-muted-foreground">
            {{ props.description }}
          </DialogDescription>
        </div>
        <div class="dialog-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6">
          <slot />
        </div>
        <div v-if="$slots.footer" class="dialog-footer grid shrink-0 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:flex sm:flex-wrap sm:justify-end sm:px-6 sm:pb-5">
          <slot name="footer" />
        </div>
        <DialogClose
          :disabled="props.persistent"
          class="dialog-close absolute right-2 top-2 grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 sm:right-3 sm:top-3"
          aria-label="关闭"
        >
          <X class="size-4" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
