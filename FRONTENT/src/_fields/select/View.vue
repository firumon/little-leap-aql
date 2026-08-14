<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldSelectView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' }
})

// Resolves the stored value back to its option label when the column's option
// list is available; otherwise falls back to the modifier/default displayValue.
const resolvedLabel = computed(() => {
  const value = model.value
  if (value == null || value === '') return null

  const options = Array.isArray(props.config?.options) ? props.config.options : []
  const match = options.find((option) =>
    option != null && typeof option === 'object' ? option.value === value : option === value
  )
  if (!match) return null
  return typeof match === 'object' ? (match.label ?? match.value) : match
})

const display = computed(() => {
  const raw = resolvedLabel.value ?? props.config?.displayValue ?? model.value
  if (raw == null) return props.emptyText
  const text = String(raw)
  return text.trim() === '' ? props.emptyText : text
})
</script>
