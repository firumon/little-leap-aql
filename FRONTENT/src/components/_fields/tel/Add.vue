<template>
  <q-input
    v-model="model"
    outlined
    v-bind="config"
    type="tel"
    inputmode="tel"
  >
    <template #prepend>
      <q-icon name="phone" />
    </template>
  </q-input>
</template>

<script setup>
defineOptions({ name: 'FieldTelAdd', inheritAttrs: false })

const model = defineModel({ default: null })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
