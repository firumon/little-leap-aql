<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
    @submit="$emit('submit')"
  />

  <FormActions
    v-else
    :page="page"
    :submit-label="finalProps.submitLabel"
    :saving="finalProps.saving"
    @cancel="$emit('cancel')"
    @submit="$emit('submit')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import FormActions from 'components/_common/sections/Action/FormActions.vue'

defineOptions({ name: 'AddActions' })

const props = defineProps({
  submitLabel: { type: String, default: 'Create' },
  saving: { type: Boolean, default: false },
  page: { type: String, default: 'Add' }
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
