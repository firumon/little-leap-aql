<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldTextView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  // Null-value fallback, shared by every View component in `_fields/`.
  emptyText: { type: String, default: '-' }
})

// `config.displayValue` is the value a resolved ViewColumn<Header>.js modifier
// produced (ViewRecord always supplies at least the schema default), so it wins
// over the raw model value.
const display = computed(() => {
  const raw = props.config?.displayValue ?? model.value
  if (raw == null) return props.emptyText
  if (typeof raw === 'string' && raw.trim() === '') return props.emptyText
  return raw
})
</script>
