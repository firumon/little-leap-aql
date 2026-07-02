<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
    @submit="$emit('submit')"
  />

  <template v-else>
    <FormActions
      :page="page"
      :submit-label="finalProps.submitLabel"
      :saving="finalProps.saving"
      @cancel="$emit('cancel')"
      @submit="$emit('submit')"
    />
    <CrudActions :page="page" />
  </template>
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import FormActions from 'components/_common/sections/Action/FormActions.vue'
import CrudActions from 'components/_common/sections/Action/CrudActions.vue'

defineOptions({ name: 'EditActions' })

const props = defineProps({
  submitLabel: { type: String, default: 'Update' },
  saving: { type: Boolean, default: false },
  page: { type: String, default: 'Edit' }
})

defineEmits(['cancel', 'submit'])

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Actions',
  page: props.page
})

const preparedProps = computed(() => ({
  submitLabel: props.submitLabel,
  saving: props.saving
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
