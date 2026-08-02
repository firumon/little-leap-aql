<template>
  <q-input
    v-model="model"
    outlined
    v-bind="config"
    type="textarea"
  />
</template>

<script setup>
defineOptions({ name: 'FieldTextareaAdd', inheritAttrs: false })

const model = defineModel({ default: null })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
