<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Gamepad2,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/api/client'
import { useAdminSession } from '@/lib/admin-session'

const router = useRouter()
const route = useRoute()
const { setSession } = useAdminSession()

const form = reactive({ email: '', password: '' })
const showPassword = ref(false)
const isSubmitting = ref(false)
const error = ref('')

const redirectTarget = computed(() => {
  const target = route.query.redirect
  if (typeof target === 'string' && target.startsWith('/admin') && target !== '/admin/login') {
    return target
  }
  return '/admin/dashboard'
})

async function submit() {
  error.value = ''
  if (!form.email.trim() || !form.password) {
    error.value = '请输入管理员邮箱和密码'
    return
  }
  isSubmitting.value = true
  try {
    const data = await api.adminLogin(form.email.trim(), form.password)
    setSession({ token: data.token, expiresAt: data.expiresAt, admin: data.admin })
    toast.success('登录成功')
    await router.replace(redirectTarget.value)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background">
    <header class="safe-top flex h-14 items-center justify-between px-4 sm:h-16 sm:px-6">
      <RouterLink to="/booking" class="flex items-center gap-2.5">
        <span class="grid size-8 place-items-center rounded-lg border border-border bg-card text-primary">
          <Gamepad2 class="size-4" />
        </span>
        <span class="text-sm font-semibold text-foreground">a_Perfect</span>
      </RouterLink>
      <ThemeToggle />
    </header>

    <main class="flex flex-1 items-center justify-center px-4 pb-10">
      <div class="w-full max-w-sm">
        <div class="mb-6">
          <div class="mb-4 grid size-11 place-items-center rounded-lg border border-border bg-card text-primary">
            <LockKeyhole class="size-5" />
          </div>
          <h1 class="text-2xl font-semibold tracking-tight text-foreground">管理员登录</h1>
          <p class="mt-1.5 text-sm text-muted-foreground">登录后管理机台和审批预约。</p>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="admin-email">邮箱</Label>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-email"
                v-model="form.email"
                type="email"
                autocomplete="username"
                placeholder="admin@example.com"
                class="pl-9"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="admin-password">密码</Label>
            <div class="relative">
              <LockKeyhole class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="输入密码"
                class="pl-9 pr-12"
              />
              <button
                type="button"
                class="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-10"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="size-4" />
                <Eye v-else class="size-4" />
              </button>
            </div>
          </div>

          <div v-if="error" class="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {{ error }}
          </div>

          <Button type="submit" size="lg" class="w-full" :disabled="isSubmitting">
            <LoaderCircle v-if="isSubmitting" class="animate-spin" />
            登录
          </Button>
        </form>

        <RouterLink
          to="/booking"
          class="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft class="size-4" />
          返回预约页
        </RouterLink>
      </div>
    </main>
  </div>
</template>
