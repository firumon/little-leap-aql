<template>
  <!-- Compact hosts (child tables, dense line items) cannot afford a preview
       card, so they get a single-line chip instead. -->
  <q-chip
    v-if="uuid && isCompact"
    dense
    square
    outline
    color="primary"
    icon="attach_file"
    class="q-ma-none"
  >
    {{ compactLabel }}
  </q-chip>
  <AqlFilePreviewCard
    v-else-if="uuid && resourceName"
    class="full-width"
    style="max-width: 280px"
    :uuid="uuid"
    :resource-name="resourceName"
    :column-name="columnName"
  />
  <span v-else>{{ emptyText }}</span>
</template>

<script setup>
import { computed } from 'vue'
import AqlFilePreviewCard from 'components/shared/AqlFilePreviewCard.vue'

defineOptions({ name: 'FieldFileView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  compact: { type: Boolean, default: false },
  compactLabel: { type: String, default: 'File' }
})

// The stored value IS the file uuid — never `displayValue`, which is only a
// human label a modifier may have produced.
const uuid = computed(() => {
  const raw = model.value
  return raw == null ? '' : String(raw).trim()
})

const isCompact = computed(() => props.compact || !!props.config?.compact)

const resourceName = computed(() => props.config?.resourceName || '')
const columnName = computed(() => props.config?.columnName || props.header || '')
</script>
