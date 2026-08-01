<template>
  <q-toggle v-model="model" v-bind="config" />
</template>

<script setup>
defineOptions({ name: 'FieldToggleAdd', inheritAttrs: false })

const model = defineModel({ default: null })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
