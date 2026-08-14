<template>
  <AppDate v-model="model" v-bind="config" />
</template>

<script setup>
import AppDate from 'components/app/Date.vue'

defineOptions({ name: 'FieldDateAdd', inheritAttrs: false })

const model = defineModel({ default: null })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
