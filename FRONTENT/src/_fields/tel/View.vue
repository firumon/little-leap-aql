<template>
  <a
    v-if="href"
    :href="href"
    class="text-primary flex items-center no-wrap"
  >
    <q-icon name="phone" size="14px" class="q-mr-xs" />
    <span class="ellipsis">{{ label }}</span>
  </a>
  <span v-else>{{ emptyText }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldTelView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' }
})

const rawValue = computed(() => {
  const raw = model.value
  return raw == null ? '' : String(raw).trim()
})

// `tel:` targets tolerate only digits, a leading +, and separators.
const href = computed(() => {
  const raw = rawValue.value
  if (!raw || raw === '-') return ''
  const dialable = raw.replace(/[^\d+]/g, '')
  return dialable ? `tel:${dialable}` : ''
})

const label = computed(() => {
  const display = props.config?.displayValue
  if (display != null && String(display).trim() !== '' && String(display).trim() !== '-') {
    return display
  }
  return rawValue.value
})
</script>
