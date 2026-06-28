<template>
  <div class="action-actions flex justify-end q-gutter-x-sm q-py-md q-px-sm" v-if="sectionsReady">
    <!-- Cancel button -->
    <component
      :is="sections.ActionCancel"
      @cancel="$emit('cancel')"
    />

    <!-- Submit Action button -->
    <component
      :is="sections.ActionSubmit"
      :label="actionLabel"
      :icon="actionIcon"
      :color="actionColor"
      :submitting="submitting"
      :disabled="submitDisabled"
      @submit="$emit('submit')"
    />
  </div>
  <div v-else class="flex justify-end q-py-md">
    <q-spinner-dots color="primary" size="20px" />
  </div>
</template>

<script setup>
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import ActionSubmit from 'components/_common/Action/ActionSubmit.vue'
import ActionCancel from 'components/_common/Action/ActionCancel.vue'

defineOptions({ name: 'ActionActions' })

defineProps({
  actionLabel: { type: String, default: 'Execute' },
  actionIcon: { type: String, default: 'check' },
  actionColor: { type: String, default: 'primary' },
  submitting: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false }
})

defineEmits(['cancel', 'submit'])

// Resolve Action Actions sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  page: 'Action/Action',
  sectionDefs: {
    ActionSubmit: { section: 'ActionSubmit', default: ActionSubmit },
    ActionCancel: { section: 'ActionCancel', default: ActionCancel }
  }
})
</script>
