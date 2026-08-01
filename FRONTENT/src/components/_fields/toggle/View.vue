<template>
  <q-chip
    v-if="label"
    dense
    square
    outline
    :color="isTruthy ? 'positive' : 'grey-7'"
    :size="isCompact ? 'sm' : undefined"
    :class="{ 'q-ma-none': isCompact }"
  >
    {{ label }}
  </q-chip>
  <span v-else>{{ emptyText }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldToggleView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  // Shrinks the chip and drops its outer margin for dense table rows.
  compact: { type: Boolean, default: false }
})

const isCompact = computed(() => props.compact || !!props.config?.compact)

const label = computed(() => {
  const raw = props.config?.displayValue ?? model.value
  if (raw == null) return ''
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  const text = String(raw).trim()
  return text === '' || text === '-' ? '' : text
})

// The stored value is the column's `true-value` (Yes / Active / True / boolean).
const isTruthy = computed(() => {
  const raw = model.value
  if (typeof raw === 'boolean') return raw
  const trueValue = props.config?.['true-value'] ?? props.config?.trueValue
  if (trueValue != null) return raw === trueValue
  return ['yes', 'active', 'true'].includes(String(raw ?? '').trim().toLowerCase())
})
</script>
