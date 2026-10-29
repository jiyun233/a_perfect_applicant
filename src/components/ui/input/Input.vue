<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const model = defineModel<string | number>()
const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <input
    v-model="model"
    :class="
      cn(
        'flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
        props.class,
      )
    "
    v-bind="$attrs"
  />
</template>
