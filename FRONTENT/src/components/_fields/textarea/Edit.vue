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

defineOptions({ name: 'FieldTextareaEdit', inheritAttrs: false })

const model = defineModel({ default: null })

defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})
</script>
