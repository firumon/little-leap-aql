<template>
  <Add
    v-model="model"
    v-bind="$attrs"
    :record="record"
    :config="config"
    :header="header"
  />
</template>

<script setup>
import Add from './Add.vue'

defineOptions({ name: 'FieldMultiselectEdit', inheritAttrs: false })

// Same array default as `Add.vue` — an existing record with no selections
// hydrates as `[]`, not `null`, so the first pick has something to push onto.
const model = defineModel({ default: () => [] })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
