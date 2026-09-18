<template>
  <q-btn-dropdown
    flat
    dense
    no-caps
    auto-close
    color="primary"
    :label="displayLabel"
    class="aql-field-menuselect text-caption"
  >
    <q-list dense style="min-width: 100px">
      <q-item
        v-for="opt in normalizedOptions"
        :key="opt.value"
        clickable
        :active="isSelected(opt.value)"
        active-class="text-weight-bold text-primary bg-grey-2"
        @click="select(opt.value)"
      >
        <q-item-section class="text-caption">{{ opt.label }}</q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FieldMenuSelectAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  placeholder: { type: String, default: 'Select...' }
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

const selectedOption = computed(() => {
  const val = model.value
  return normalizedOptions.value.find((opt) => opt.value === val)
})

const displayLabel = computed(() => {
  if (selectedOption.value) return selectedOption.value.label
  if (model.value != null && model.value !== '') return String(model.value)
  return props.placeholder
})

function isSelected (val) {
  return model.value === val
}

function select (val) {
  model.value = val
}
</script>
