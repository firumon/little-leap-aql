<template>
  <q-input
    v-model="model"
    outlined
    v-bind="config"
    type="url"
    :hint="config.hint || 'Full URL, e.g. https://example.com'"
  >
    <template #prepend>
      <q-icon name="link" />
    </template>
  </q-input>
</template>

<script setup>
defineOptions({ name: 'FieldLinkAdd', inheritAttrs: false })

const model = defineModel({ default: null })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
