<template>
  <div class="filter-input-container">
    <q-input
      v-model="filterTerm"
      v-bind="finalAttrs"
      class="filter-input"
      :clearable="finalAttrs.clearable"
      :clear-icon="finalAttrs.clearIcon"
    >
      <template #prepend v-if="finalAttrs.icon">
        <q-icon :name="finalAttrs.icon" :color="finalAttrs.iconColor" />
      </template>
    </q-input>
  </div>
</template>

<script setup>
import { computed, inject, ref, useAttrs } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'SectionsFilterInput', inheritAttrs: false })

const props = defineProps({
  outlined: { type: [Boolean, Function], default: true },
  debounce: { type: [Number, String, Function], default: 180 },
  placeholder: { type: [String, Function], default: 'Filter code, name, or any field...' },
  icon: { type: [String, Function], default: 'filter_list' },
  iconColor: { type: [String, Function], default: 'grey-6' },
  clearable: { type: [Boolean, Function], default: true },
  clearIcon: { type: [String, Function], default: 'cancel' },
  label: { type: [String, Function], default: '' },
})

const attrs = useAttrs()

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const filterTerm = resourceRecord?.filterTerm || ref('')

const finalAttrs = computed(() => ({
  ...attrs,
  outlined: evaluateProp(props.outlined, resourceRecord, resourceConfig) ?? true,
  debounce: evaluateProp(props.debounce, resourceRecord, resourceConfig) ?? 180,
  placeholder: evaluateProp(props.placeholder, resourceRecord, resourceConfig) ?? 'Filter code, name, or any field...',
  icon: evaluateProp(props.icon, resourceRecord, resourceConfig) ?? 'filter_list',
  iconColor: evaluateProp(props.iconColor, resourceRecord, resourceConfig) ?? 'grey-6',
  clearable: evaluateProp(props.clearable, resourceRecord, resourceConfig) ?? true,
  clearIcon: evaluateProp(props.clearIcon, resourceRecord, resourceConfig) ?? 'cancel',
  label: evaluateProp(props.label, resourceRecord, resourceConfig) || undefined
}))

function clearFilter() {
  filterTerm.value = ''
}
</script>
