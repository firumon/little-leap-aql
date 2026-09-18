<template>
  <div class="row items-center q-gutter-xs wrap aql-field-chipselect">
    <q-chip
      v-for="opt in normalizedOptions"
      :key="opt.value"
      clickable
      dense
      size="sm"
      :color="isSelected(opt.value) ? 'primary' : undefined"
      :text-color="isSelected(opt.value) ? 'white' : 'grey-8'"
      :outline="!isSelected(opt.value)"
      @click="select(opt.value)"
    >
      {{ opt.label }}
    </q-chip>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldChipSelectAdd', inheritAttrs: false })

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

function isSelected (val) {
  return model.value === val
}

function select (val) {
  model.value = val
}
</script>
