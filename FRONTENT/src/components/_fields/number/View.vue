<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldNumberView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  locale: { type: String, default: 'en-GB' },
  // Left undefined so integers stay integers and decimals keep their precision.
  numberOptions: { type: Object, default: () => ({ maximumFractionDigits: 4 }) }
})

const display = computed(() => {
  const modifier = props.config?.displayValue
  const raw = model.value

  const hasModifierValue =
    modifier != null && String(modifier).trim() !== '' && String(modifier).trim() !== '-'
  if (hasModifierValue && modifier !== raw) return modifier

  if (raw == null || String(raw).trim() === '' || String(raw).trim() === '-') return props.emptyText

  const numeric = Number(raw)
  if (Number.isNaN(numeric)) return String(raw)
  return numeric.toLocaleString(props.locale, props.numberOptions)
})
</script>
