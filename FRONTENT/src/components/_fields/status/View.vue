<template>
  <q-chip
    v-if="label"
    dense
    square
    :color="color"
    text-color="white"
    :size="isCompact ? 'sm' : undefined"
    :class="['text-weight-medium', { 'q-ma-none': isCompact }]"
  >
    {{ label }}
  </q-chip>
  <span v-else>{{ emptyText }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldStatusView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  // Drops the chip's outer margin and shrinks it so a dense table row keeps
  // its line height. Also honoured via `config.compact`.
  compact: { type: Boolean, default: false },
  // Per-status colour map, overridable through `config.statusColors` so a
  // resource with a bespoke workflow can recolour without a custom component.
  statusColors: {
    type: Object,
    default: () => ({
      active: 'positive',
      approved: 'positive',
      completed: 'positive',
      done: 'positive',
      received: 'positive',
      yes: 'positive',
      inactive: 'negative',
      cancelled: 'negative',
      canceled: 'negative',
      rejected: 'negative',
      failed: 'negative',
      no: 'negative',
      pending: 'warning',
      planned: 'warning',
      postponed: 'warning',
      draft: 'warning',
      partial: 'warning'
    })
  },
  fallbackColor: { type: String, default: 'grey-7' }
})

const label = computed(() => {
  const raw = props.config?.displayValue ?? model.value
  if (raw == null) return ''
  const text = String(raw).trim()
  return text === '' || text === '-' ? '' : text
})

const isCompact = computed(() => props.compact || !!props.config?.compact)

const colorMap = computed(() => ({ ...props.statusColors, ...(props.config?.statusColors || {}) }))

const color = computed(() => colorMap.value[label.value.toLowerCase()] || props.fallbackColor)
</script>
