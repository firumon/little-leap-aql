<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
    @submit="$emit('submit')"
  />

  <div v-else class="action-actions flex justify-end q-gutter-x-sm q-py-md q-px-sm">
    <!-- Cancel button -->
    <ActionCancel :page="page" @cancel="$emit('cancel')" />

    <!-- Submit Action button -->
    <ActionSubmit
      :page="page"
      :label="finalProps.actionLabel"
      :icon="finalProps.actionIcon"
      :color="finalProps.actionColor"
      :submitting="finalProps.submitting"
      :disabled="finalProps.submitDisabled"
      @submit="$emit('submit')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import ActionSubmit from 'components/_common/Action/ActionSubmit.vue'
import ActionCancel from 'components/_common/Action/ActionCancel.vue'

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
