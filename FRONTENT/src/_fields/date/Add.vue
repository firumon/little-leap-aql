<template>
  <!-- `outlined` BEFORE `config`, so a caller can still opt out. Every other `_fields/*/Add`
       control is outlined; this one was not, which made a date field the only input on a form
       that rendered without a border. The default belongs here rather than in each caller's
       `config`, so every date field in the app picks it up. -->
  <AppDate v-model="model" outlined v-bind="config" />
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
