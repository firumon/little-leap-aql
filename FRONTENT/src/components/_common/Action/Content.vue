<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @update:selected-outcome="(val) => $emit('update:selected-outcome', val)"
    @update:action-field="(header, val) => $emit('update:action-field', header, val)"
  />

  <!-- Fallback template -->
  <div v-else class="action-content">
    <!-- Form is statically imported, handles self-override internally -->
    <Form
      :is-multi-outcome="isMultiOutcome"
      :outcome-options="outcomeOptions"
      :selected-outcome="selectedOutcome"
      :resolved-action-fields="resolvedActionFields"
      :action-form="actionForm"
      :form-config="finalProps.formConfig"
      :page="page"
      @update:selected-outcome="(val) => $emit('update:selected-outcome', val)"
      @update:action-field="(header, val) => $emit('update:action-field', header, val)"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import Form from 'components/_common/Content/Form.vue'

defineOptions({ name: 'ActionContent' })

const props = defineProps({
  isMultiOutcome: { type: Boolean, default: false },
  outcomeOptions: { type: Array, default: () => [] },
  selectedOutcome: { type: String, default: '' },
  resolvedActionFields: { type: Array, default: () => [] },
  actionForm: { type: Object, default: () => ({}) },
  page: { type: String, default: 'Action' }
})

defineEmits([
  'update:selected-outcome',
  'update:action-field'
])

const { resourceSlug, scope, customUIName } = inject('resourceConfig')

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Content',
  page: props.page
})

const preparedProps = computed(() => ({
  isMultiOutcome: props.isMultiOutcome,
  outcomeOptions: props.outcomeOptions,
  selectedOutcome: props.selectedOutcome,
  resolvedActionFields: props.resolvedActionFields,
  actionForm: props.actionForm,
  formConfig: {}
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
