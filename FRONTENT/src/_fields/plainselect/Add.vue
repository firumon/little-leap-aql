<template>
  <q-btn-toggle
    v-model="model"
    flat
    dense
    no-caps
    color="grey-6"
    toggle-color="primary"
    :options="normalizedOptions"
    class="aql-field-plainselect text-caption"
  />
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldPlainSelectAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

const normalizedOptions = computed(() => {
  const raw = Array.isArray(props.config?.options) ? props.config.options : []
  return raw.map((opt) => {
    if (opt != null && typeof opt === 'object') {
      return {
        label: String(opt.label ?? opt.value ?? ''),
        value: opt.value
      }
    }
    return { label: String(opt), value: opt }
  })
})
</script>
