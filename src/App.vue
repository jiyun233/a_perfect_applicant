<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import { useTheme } from '@/composables/useTheme'

const { isDark } = useTheme()
</script>

<template>
  <RouterView />
  <Toaster
    :theme="isDark ? 'dark' : 'light'"
    position="top-center"
    :duration="3000"
    :toast-options="{
      style: {
        background: 'var(--card)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
      },
    }"
  />
</template>
