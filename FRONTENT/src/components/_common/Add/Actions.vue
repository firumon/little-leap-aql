<template>
  <div class="add-actions flex justify-end q-gutter-x-sm q-py-md q-px-sm" v-if="sectionsReady">
    <!-- Cancel button -->
    <component
      :is="sections.FormCancel"
      @cancel="$emit('cancel')"
    />

    <!-- Submit button -->
    <component
      :is="sections.FormSubmit"
      :label="submitLabel"
      :saving="saving"
      @submit="$emit('submit')"
    />
  </div>
  <div v-else class="flex justify-end q-py-md">
    <q-spinner-dots color="primary" size="20px" />
  </div>
</template>

<script setup>
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import FormSubmit from 'components/_common/Action/FormSubmit.vue'
import FormCancel from 'components/_common/Action/FormCancel.vue'

defineOptions({ name: 'AddActions' })

defineProps({
  submitLabel: { type: String, default: 'Create' },
  saving: { type: Boolean, default: false }
})

defineEmits(['cancel', 'submit'])

// Resolve Add Actions sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  page: 'Add/Action',
  sectionDefs: {
    FormSubmit: { section: 'FormSubmit', default: FormSubmit },
    FormCancel: { section: 'FormCancel', default: FormCancel }
  }
})
</script>
