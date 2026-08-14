<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldDatetimeView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  // Matches `_fields/date/View.vue` — "02 Aug 2026" — plus a 24-hour clock, so a
  // date column and a date-time column read as the same family in one record.
  locale: { type: String, default: 'en-GB' },
  dateOptions: {
    type: Object,
    default: () => ({
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    })
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

  // Rows stamped before the backend switched to `YYYY-MM-DD HH:mm:ss` still hold
  // epoch milliseconds, so an all-digit value is read as a number rather than as
  // a date string (which would parse as a year).
  const text = String(raw).trim()
  const parsed = new Date(/^\d+$/.test(text) ? Number(text) : text.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return text

  return parsed.toLocaleString(props.locale, props.dateOptions)
})
</script>
