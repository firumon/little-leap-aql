<template>
  <!-- Multiline text would blow out a dense table row, so a compact host gets a
       single ellipsized line instead. -->
  <span v-if="isCompact" class="ellipsis">{{ display }}</span>
  <span v-else style="white-space: pre-line">{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldTextareaView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  // Collapses the multiline rendering to one ellipsized line.
  compact: { type: Boolean, default: false }
})

const isCompact = computed(() => props.compact || !!props.config?.compact)

const display = computed(() => {
  const raw = props.config?.displayValue ?? model.value
  if (raw == null) return props.emptyText
  const text = String(raw)
  return text.trim() === '' ? props.emptyText : text
})
</script>
