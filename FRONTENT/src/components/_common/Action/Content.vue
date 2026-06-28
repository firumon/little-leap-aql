<template>
  <div class="action-content" v-if="sectionsReady">
    <component
      :is="sections.ActionFields"
      :is-multi-outcome="isMultiOutcome"
      :outcome-options="outcomeOptions"
      :selected-outcome="selectedOutcome"
      :resolved-action-fields="resolvedActionFields"
      :action-form="actionForm"
      @update:selected-outcome="(val) => $emit('update:selected-outcome', val)"
      @update:action-field="(header, val) => $emit('update:action-field', header, val)"
    />
  </div>
  <div v-else class="flex flex-center q-py-md">
    <q-spinner-dots color="primary" size="24px" />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'ActionContent' })

const props = defineProps({
  isMultiOutcome: { type: Boolean, default: false },
  outcomeOptions: { type: Array, default: () => [] },
  selectedOutcome: { type: String, default: '' },
  resolvedActionFields: { type: Array, default: () => [] },
  actionForm: { type: Object, default: () => ({}) }
})

defineEmits([
  'update:selected-outcome',
  'update:action-field'
])

const { resourceSlug, scope } = inject('resourceConfig')

const EmptyComponent = { name: 'ActionFieldsEmpty', render() { return null } }

// Resolve Content ActionFields sub-section recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Action/Content',
  sectionDefs: {
    ActionFields: { section: 'ActionFields', default: EmptyComponent }
  }
})
</script>
