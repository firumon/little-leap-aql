<template>
  <div class="edit-actions flex justify-end q-gutter-x-sm q-py-md q-px-sm" v-if="sectionsReady">
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

defineOptions({ name: 'EditActions' })

defineProps({
  submitLabel: { type: String, default: 'Update' },
  saving: { type: Boolean, default: false }
})

defineEmits(['cancel', 'submit'])

// Resolve Edit Actions sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  page: 'Edit/Action',
  sectionDefs: {
    FormSubmit: { section: 'FormSubmit', default: FormSubmit },
    FormCancel: { section: 'FormCancel', default: FormCancel }
  }
})
</script>
