<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>()
const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <textarea
    v-model="model"
    :class="
      cn(
        'flex min-h-[104px] w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-base text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
        props.class,
      )
    "
    v-bind="$attrs"
  />
</template>
