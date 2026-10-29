<script setup lang="ts">
import { ArrowLeft, SearchX } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="mx-auto flex min-h-[55vh] max-w-sm flex-col items-center justify-center text-center">
    <SearchX class="size-10 text-muted-foreground" />
    <p class="mt-4 text-3xl font-semibold text-foreground">404</p>
    <h1 class="mt-2 text-lg font-medium text-foreground">页面不存在</h1>
    <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">链接可能有误，或页面已被移动。</p>
    <Button as-child class="mt-6">
      <RouterLink to="/booking">
        <ArrowLeft class="size-4" />
        返回预约
      </RouterLink>
    </Button>
  </div>
</template>
