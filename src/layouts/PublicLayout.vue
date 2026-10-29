<script setup lang="ts">
import { CalendarClock, Gamepad2, ShieldCheck } from 'lucide-vue-next'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'

const route = useRoute()

const navItems = [
  { to: '/booking', label: '预约', icon: CalendarClock },
  { to: '/machines', label: '机台', icon: Gamepad2 },
]

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background">
    <header class="safe-top sticky top-0 z-40 border-b border-border bg-background">
      <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        <RouterLink to="/booking" class="flex min-w-0 items-center gap-2.5">
          <span class="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary">
            <Gamepad2 class="size-[18px]" />
          </span>
          <span class="min-w-0 leading-tight">
            <span class="block truncate text-[15px] font-semibold text-foreground">a_Perfect</span>
            <span class="hidden text-xs text-muted-foreground sm:block">实验室机台预约</span>
          </span>
        </RouterLink>

        <nav class="ml-4 hidden items-center gap-1 sm:flex" aria-label="主导航">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
            :class="
              isActive(item.to)
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            "
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <RouterLink
            to="/admin"
            class="inline-flex size-11 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-10 sm:w-auto sm:px-3"
            aria-label="管理入口"
          >
            <ShieldCheck class="size-[18px]" />
            <span class="hidden sm:inline">管理</span>
          </RouterLink>
        </div>
      </div>
    </header>

    <main class="mobile-page-bottom mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:pb-10">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <footer class="border-t border-border">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-[11px] leading-relaxed text-muted-foreground sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:pb-5">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-colors hover:text-foreground"
          >
            闽ICP备2026006101号-1
          </a>
          <span>© 2026 Moe jiyun233. All Rights Reserved.</span>
        </div>
        <p class="max-w-md sm:text-right">
          Site Secured &amp; Accelerated by Tencent Cloud EdgeOne · Pages · Security · CDN
        </p>
      </div>
    </footer>

    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background safe-bottom sm:hidden"
      aria-label="移动端主导航"
    >
      <div class="grid grid-cols-2">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors"
          :class="isActive(item.to) ? 'text-primary' : 'text-muted-foreground'"
        >
          <component :is="item.icon" class="size-5" />
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
