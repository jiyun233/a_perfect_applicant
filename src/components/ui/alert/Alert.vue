<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div :class="cn('relative w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm', props.class)">
    <slot />
  </div>
</template>
