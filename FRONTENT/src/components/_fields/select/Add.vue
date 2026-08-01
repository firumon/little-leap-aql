<template>
  <q-select
    v-model="model"
    outlined
    emit-value
    map-options
    v-bind="config"
    :options="filteredOptions"
    use-input
    input-debounce="200"
    @filter="onFilter"
  >
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey-6">No matching options</q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'FieldSelectAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

const baseOptions = computed(() => (Array.isArray(props.config?.options) ? props.config.options : []))

// Local filtering buffer. Re-seeded whenever the upstream option list changes
// (relation pickers rebuild theirs as the target resource syncs).
const filteredOptions = ref(baseOptions.value)

watch(baseOptions, (next) => { filteredOptions.value = next })

function optionLabel (option) {
  if (option == null) return ''
  if (typeof option === 'object') return String(option.label ?? option.value ?? '')
  return String(option)
}

function onFilter (needle, update) {
  update(() => {
    const term = String(needle || '').trim().toLowerCase()
    filteredOptions.value = term
      ? baseOptions.value.filter((option) => optionLabel(option).toLowerCase().includes(term))
      : baseOptions.value
  })
}
</script>
