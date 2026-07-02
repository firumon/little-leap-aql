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
    :submit-label="finalProps.actionLabel"
    :saving="finalProps.submitting"
    :disabled="finalProps.submitDisabled"
    @cancel="$emit('cancel')"
    @submit="$emit('submit')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import FormActions from 'components/_common/sections/Action/FormActions.vue'

defineOptions({ name: 'ActionActions' })

const props = defineProps({
  actionLabel: { type: String, default: 'Execute' },
  actionIcon: { type: String, default: 'check' },
  actionColor: { type: String, default: 'primary' },
  submitting: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false },
  page: { type: String, default: 'Action' }
})

defineEmits(['cancel', 'submit'])

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Actions',
  page: props.page
})

const preparedProps = computed(() => ({
  actionLabel: props.actionLabel,
  actionIcon: props.actionIcon,
  actionColor: props.actionColor,
  submitting: props.submitting,
  submitDisabled: props.submitDisabled
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
