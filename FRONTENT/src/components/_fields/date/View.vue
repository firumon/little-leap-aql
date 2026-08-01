<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldDateView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  // Matches the app-wide "02 Aug 2026" convention used elsewhere in appHelpers.
  locale: { type: String, default: 'en-GB' },
  dateOptions: {
    type: Object,
    default: () => ({ day: '2-digit', month: 'short', year: 'numeric' })
  }
})

// A modifier-supplied displayValue is already formatted for humans, so only the
// raw stored value goes through Date parsing.
const display = computed(() => {
  const modifier = props.config?.displayValue
  const raw = model.value

  const hasModifierValue =
    modifier != null && String(modifier).trim() !== '' && String(modifier).trim() !== '-'
  if (hasModifierValue && modifier !== raw) return modifier

  if (raw == null || String(raw).trim() === '' || String(raw).trim() === '-') return props.emptyText

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return String(raw)
  return parsed.toLocaleDateString(props.locale, props.dateOptions)
})
</script>
