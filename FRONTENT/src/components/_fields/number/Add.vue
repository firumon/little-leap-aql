<template>
  <q-input
    v-model.number="model"
    outlined
    v-bind="config"
    type="number"
    inputmode="decimal"
  />
</template>

<script setup>
defineOptions({ name: 'FieldNumberAdd', inheritAttrs: false })

const model = defineModel({ default: null })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
