<template>
  <AqlFileUpload
    v-model="model"
    v-bind="config"
    :resource-name="resourceName"
    :column-name="columnName"
  />
</template>

<script setup>
import { computed } from 'vue'
import AqlFileUpload from 'components/shared/AqlFileUpload.vue'

defineOptions({ name: 'FieldFileAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

// AqlFileUpload requires both to build the storage key; `config` carries them
// for schema fields, `header` covers custom (non-schema) headers.
const resourceName = computed(() => props.config?.resourceName || '')
const columnName = computed(() => props.config?.columnName || props.header || '')
</script>
