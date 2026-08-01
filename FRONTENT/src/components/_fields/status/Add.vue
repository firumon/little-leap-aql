<template>
  <!-- An options list means a multi-state status column -> select.
       No options means the classic Active/Inactive pair -> toggle. -->
  <q-select
    v-if="hasOptions"
    v-model="model"
    outlined
    emit-value
    map-options
    v-bind="config"
  />
  <AqlStatusToggle
    v-else
    v-model="model"
    v-bind="config"
  />
</template>

<script setup>
import { computed } from 'vue'
import AqlStatusToggle from 'components/shared/AqlStatusToggle.vue'

defineOptions({ name: 'FieldStatusAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

const hasOptions = computed(() => Array.isArray(props.config?.options) && props.config.options.length > 0)
</script>
