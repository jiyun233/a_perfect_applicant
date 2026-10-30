<script setup lang="ts">
import { computed } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import { cn } from '@/lib/utils'

type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

const EMPTY_VALUE = '__empty__'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    options: SelectOption[]
    placeholder?: string
    id?: string
    disabled?: boolean
    class?: string
    ariaLabel?: string
  }>(),
  {
    modelValue: '',
    placeholder: '请选择',
    id: undefined,
    disabled: false,
    class: '',
    ariaLabel: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const internalValue = computed(() => props.modelValue || EMPTY_VALUE)

function optionValue(value: string) {
  return value || EMPTY_VALUE
}

function onValueChange(value: unknown) {
  const next = String(value ?? '')
  emit('update:modelValue', next === EMPTY_VALUE ? '' : next)
}
</script>

<template>
  <SelectRoot
    :model-value="internalValue"
    :disabled="props.disabled"
    @update:model-value="onValueChange"
  >
    <SelectTrigger
      :id="props.id"
      type="button"
      :aria-label="props.ariaLabel"
      :class="
        cn(
          'flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-base text-foreground transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
          props.class,
        )
      "
    >
      <SelectValue :placeholder="props.placeholder" class="min-w-0 truncate" />
      <SelectIcon class="shrink-0 text-muted-foreground">
        <ChevronDown class="size-4" />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        :collision-padding="12"
        class="z-[100] max-h-[min(18rem,var(--reka-select-content-available-height))] w-[var(--reka-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg"
      >
        <SelectViewport class="overscroll-contain p-1">
          <SelectItem
            v-for="option in props.options"
            :key="option.value"
            :value="optionValue(option.value)"
            :disabled="option.disabled"
            class="relative flex min-h-11 cursor-pointer select-none items-center rounded-md py-2 pl-2.5 pr-8 text-sm break-words outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted data-[state=checked]:text-foreground sm:min-h-9"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="absolute right-2">
              <Check class="size-4 text-primary" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
