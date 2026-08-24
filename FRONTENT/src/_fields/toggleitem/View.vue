<template>
  <div class="row items-center no-wrap q-col-gutter-sm">
    <div class="col">
      <div :class="compactMode ? 'text-body2' : 'text-subtitle2 text-weight-medium'">{{ title }}</div>
      <div v-if="description && !compactMode" class="text-caption text-grey-7">{{ description }}</div>
    </div>
    <div class="col-auto">
      <q-chip
        square
        outline
        :color="isTruthy ? 'positive' : 'grey-7'"
        :size="compactMode ? 'sm' : undefined"
        :class="{ 'q-ma-none': compactMode }"
      >
        {{ stateLabel }}
      </q-chip>
    </div>
  </div>
</template>

<script setup>
// Read-only mirror of the Add row: same title/description on the left, the settled state as
// a chip where the switch was, so a view page and its form read the same shape.
import { computed } from 'vue'

defineOptions({ name: 'FieldToggleitemView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  compact: { type: Boolean, default: false }
})

const compactMode = computed(() => props.compact || !!props.config?.compact)

const title = computed(() => props.config?.label ?? props.config?.title ?? props.header ?? '')
const description = computed(() => props.config?.caption ?? props.config?.description ?? '')

// The stored value is the column's `true-value` (Yes / Active / True / boolean).
const isTruthy = computed(() => {
  const raw = model.value
  if (typeof raw === 'boolean') return raw
  const trueValue = props.config?.['true-value'] ?? props.config?.trueValue
  if (trueValue != null) return raw === trueValue
  return ['yes', 'active', 'true'].includes(String(raw ?? '').trim().toLowerCase())
})

const stateLabel = computed(() => {
  const raw = props.config?.displayValue ?? model.value
  if (raw == null || String(raw).trim() === '') return props.emptyText
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  return String(raw).trim()
})
</script>
