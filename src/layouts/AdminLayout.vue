<script setup lang="ts">
import { watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  ArrowUpRight,
  ClipboardCheck,
  Gamepad2,
  LayoutDashboard,
  LogOut,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { useAdminSession } from '@/lib/admin-session'

const route = useRoute()
const router = useRouter()
const { session, admin, clearSession } = useAdminSession()

const navItems = [
  { to: '/admin/dashboard', label: '概览', icon: LayoutDashboard },
  { to: '/admin/machines', label: '机台', icon: Gamepad2 },
  { to: '/admin/reservations', label: '预约', icon: ClipboardCheck },
]

watch(session, (value) => {
  if (!value) {
    void router.replace({ path: '/admin/login', query: { redirect: route.fullPath } })
  }
})

function logout() {
  clearSession()
  toast.success('已退出管理后台')
  void router.replace('/admin/login')
}
</script>

<template>
  <div class="min-h-dvh bg-background">
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      <div class="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span class="grid size-9 place-items-center rounded-lg border border-border bg-background text-primary">
          <Gamepad2 class="size-[18px]" />
        </span>
        <span class="leading-tight">
          <span class="block text-[15px] font-semibold text-foreground">a_Perfect</span>
          <span class="block text-xs text-muted-foreground">管理后台</span>
        </span>
      </div>

      <nav class="flex-1 space-y-1 p-3" aria-label="管理导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"
          :class="
            route.path === item.to
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          "
        >
          <component :is="item.icon" class="size-[18px]" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="space-y-3 border-t border-border p-3">
        <RouterLink
          to="/booking"
          target="_blank"
          class="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowUpRight class="size-4" />
          成员端
        </RouterLink>
        <div class="rounded-lg border border-border p-3">
          <div class="flex items-center gap-2.5">
            <span class="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium text-foreground">
              {{ admin?.displayName?.slice(0, 1) || 'A' }}
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-foreground">{{ admin?.displayName || '管理员' }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ admin?.email }}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" class="mt-3 w-full" @click="logout">
            <LogOut class="size-3.5" />
            退出登录
          </Button>
        </div>
      </div>
    </aside>

    <div class="lg:pl-60">
      <header class="safe-top sticky top-0 z-30 border-b border-border bg-background">
        <div class="page-gutter flex min-h-14 items-center gap-3 sm:min-h-16">
          <RouterLink to="/admin/dashboard" class="flex items-center gap-2 lg:hidden">
            <span class="grid size-8 place-items-center rounded-lg border border-border bg-card text-primary">
              <Gamepad2 class="size-4" />
            </span>
            <span class="text-sm font-semibold text-foreground">管理后台</span>
          </RouterLink>
          <span class="hidden text-sm font-medium text-foreground lg:block">管理后台</span>
          <div class="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button as-child variant="ghost" size="sm" class="hidden sm:inline-flex">
              <RouterLink to="/booking" target="_blank">
                成员端 <ArrowUpRight class="size-3.5" />
              </RouterLink>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="lg:hidden"
              aria-label="退出登录"
              @click="logout"
            >
              <LogOut class="size-[18px]" />
            </Button>
          </div>
        </div>
      </header>

      <main class="page-gutter mobile-page-bottom mx-auto w-full min-w-0 max-w-6xl py-5 sm:py-8 lg:pb-10">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background safe-bottom lg:hidden"
      aria-label="移动端管理导航"
    >
      <div class="page-gutter grid grid-cols-3">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors"
          :class="route.path === item.to ? 'text-primary' : 'text-muted-foreground'"
        >
          <component :is="item.icon" class="size-5" />
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
