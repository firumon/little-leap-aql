<template>
  <span v-if="!labels.length">{{ emptyText }}</span>
  <div v-else class="row inline items-center q-gutter-xs">
    <q-chip
      v-for="entry in labels"
      :key="entry.key"
      dense
      square
      :color="config?.chipColor || 'grey-3'"
      :text-color="config?.chipTextColor || 'grey-9'"
      :label="entry.label"
    />
  </div>
</template>

<script setup>
/**
 * Read-only rendering of a multi-value selection.
 *
 * Chips rather than a joined string: the values are discrete, and a comma-joined
 * run of them is unreadable the moment one of the labels itself contains a comma.
 */
import { computed } from 'vue'

defineOptions({ name: 'FieldMultiselectView', inheritAttrs: false })

const model = defineModel({ default: () => [] })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' }
})

/**
 * Accepts either a real array or the CSV a sheet column stores it as — the same
 * value round-trips through GAS as `"A,B"`, so a view rendered straight off a
 * record must handle both without the caller pre-parsing.
 */
const values = computed(() => {
  const raw = model.value
  if (Array.isArray(raw)) return raw.filter((value) => value != null && value !== '')
  if (raw == null || raw === '') return []
  return String(raw).split(',').map((value) => value.trim()).filter(Boolean)
})

// Resolves each stored value back to its option label when the column's option
// list is available; an unmatched value still renders as itself rather than
// vanishing, so a stale code is visible instead of silently dropped.
const labels = computed(() => {
  const options = Array.isArray(props.config?.options) ? props.config.options : []
  return values.value.map((value, index) => {
    const match = options.find((option) =>
      option != null && typeof option === 'object' ? option.value === value : option === value
    )
    const label = match && typeof match === 'object' ? (match.label ?? match.value) : (match ?? value)
    return { key: `${String(value)}-${index}`, label: String(label) }
  })
})
</script>
