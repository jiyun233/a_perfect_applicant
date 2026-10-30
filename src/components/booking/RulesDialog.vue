<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { marked } from 'marked'
import { FileText } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

const props = withDefaults(
  defineProps<{
    open: boolean
    markdown: string
    seconds?: number
  }>(),
  { seconds: 5 },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  accept: []
}>()

const remaining = ref(props.seconds)
let timer: number | undefined

const html = computed(() => marked.parse(props.markdown, { async: false }) as string)
const canContinue = computed(() => remaining.value <= 0)

function stopTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

function startTimer() {
  stopTimer()
  remaining.value = props.seconds
  timer = window.setInterval(() => {
    if (remaining.value > 0) remaining.value -= 1
    if (remaining.value <= 0) stopTimer()
  }, 1000)
}

watch(
  () => props.open,
  (open) => {
    if (open) startTimer()
    else stopTimer()
  },
  { immediate: true },
)

onBeforeUnmount(stopTimer)

function close() {
  stopTimer()
  emit('update:open', false)
}

function accept() {
  if (!canContinue.value) return
  stopTimer()
  emit('update:open', false)
  emit('accept')
}
</script>

<template>
  <Dialog
    :open="props.open"
    title="预约前请阅读"
    description="请先阅读规则，倒计时结束后才能继续人机验证。"
    persistent
    class="max-w-2xl"
    @update:open="emit('update:open', $event)"
  >
    <div class="rules-markdown" v-html="html" />

    <template #footer>
      <Button variant="ghost" class="w-full sm:w-auto" @click="close">取消</Button>
      <Button class="w-full sm:w-auto" :disabled="!canContinue" @click="accept">
        <FileText class="size-4" />
        {{ canContinue ? '我已阅读，继续验证' : `请阅读规则（${remaining}s）` }}
      </Button>
    </template>
  </Dialog>
</template>

<style scoped>
.rules-markdown {
  max-height: min(52dvh, 26rem);
  overflow-y: auto;
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
