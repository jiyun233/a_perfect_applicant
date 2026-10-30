<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { loadTencentCaptcha, type CaptchaInstance } from '@/lib/tencent-captcha'

const props = defineProps<{ appId: string }>()
const emit = defineEmits<{
  verified: [credentials: { ticket: string; randstr: string }]
  cancel: []
  error: [message: string]
}>()

const guard = ref<HTMLElement>()
let instance: CaptchaInstance | undefined
let active = true
let settled = false
let app: HTMLElement | null = null
let wasInert = false

function cancel() {
  if (settled) return
  settled = true
  emit('cancel')
}

onMounted(async () => {
  // The SDK portals its popup to body. Let Reka release its pointer/focus lock
  // before showing it; an independent backdrop and inert app protect the page.
  app = document.getElementById('app')
  wasInert = app?.inert ?? false
  if (app) app.inert = true
  await nextTick()
  if (!active) return
  guard.value?.focus({ preventScroll: true })
  try {
    const Ctor = await loadTencentCaptcha()
    // Cached SDK loads are synchronous. Give the browser a frame to commit the
    // removed modal before mounting another interactive layer.
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    if (!active || settled) return
    instance = new Ctor(props.appId, (result) => {
      if (!active || settled) return
      settled = true
      if (result.ret === 0 && result.ticket && result.randstr && !result.errorCode) {
        emit('verified', { ticket: result.ticket, randstr: result.randstr })
      } else if (result.ret === 2) {
        emit('cancel')
      } else {
        emit('error', result.errorMessage || '人机验证未通过，请重试。')
      }
    }, { userLanguage: 'zh-cn' })
    instance.show()
  } catch {
    if (active && !settled) {
      settled = true
      emit('error', '验证码加载失败或超时，请检查网络后重试。')
    }
  }
})

onBeforeUnmount(() => {
  active = false
  try {
    instance?.destroy()
  } finally {
    if (app) app.inert = wasInert
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="guard"
      class="captcha-guard fixed inset-0 z-[60] grid place-items-center overflow-y-auto overscroll-contain bg-black/50 p-4 outline-none"
      role="region"
      aria-label="人机验证"
      tabindex="-1"
      @keydown.esc.prevent="cancel"
    >
      <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-xl">
        <LoaderCircle class="mx-auto size-6 animate-spin text-primary" />
        <p class="mt-3 text-base font-medium" role="status">请完成人机验证</p>
        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">正在打开验证码；如长时间未出现，可以返回重试。已填写的信息会保留。</p>
        <Button variant="outline" class="mt-5 w-full" @click="cancel">返回预约</Button>
      </div>
    </div>
  </Teleport>
</template>

<style>
html:has(.captcha-guard),
body:has(.captcha-guard) {
  overflow: hidden;
}
</style>
