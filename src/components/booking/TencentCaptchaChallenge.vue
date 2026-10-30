<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { loadTencentCaptcha, type CaptchaInstance } from '@/lib/tencent-captcha'

const props = defineProps<{ appId: string }>()
const emit = defineEmits<{
  verified: [credentials: { ticket: string; randstr: string }]
  cancel: []
  error: [message: string]
}>()

let instance: CaptchaInstance | undefined
let active = true
let settled = false

onMounted(async () => {
  await nextTick()
  if (!active) return
  try {
    const Ctor = await loadTencentCaptcha()
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
  instance?.destroy()
})
</script>

<template>
  <span class="sr-only" role="status">正在打开人机验证</span>
</template>
