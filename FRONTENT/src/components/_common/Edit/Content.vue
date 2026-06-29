<template>
  <div class="edit-content" v-if="sectionsReady">
    <component
      :is="sections.Form"
      :config="config"
      :code="code"
      :resolved-fields="resolvedFields"
      :parent-form="parentForm"
      :child-groups="childGroups"
      :status-options="statusOptions"
      @update:field="(header, val) => $emit('update:field', header, val)"
      @add-child="(slug) => $emit('add-child', slug)"
      @remove-child="(slug, idx) => $emit('remove-child', slug, idx)"
      @update-child-field="(slug, idx, header, val) => $emit('update-child-field', slug, idx, header, val)"
    />
  </div>
  <div v-else class="flex flex-center q-py-md">
    <q-spinner-dots color="primary" size="24px" />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import Form from 'components/_common/Content/Form.vue'

defineOptions({ name: 'EditContent' })

const props = defineProps({
  parentForm: Object,
  childGroups: Object,
  statusOptions: Array
})

defineEmits([
  'update:field',
  'add-child',
  'remove-child',
  'update-child-field'
])

const { resourceSlug, scope, config, code, resolvedFields } = inject('resourceConfig')

// Resolve Content Form sub-section recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Edit/Content',
  sectionDefs: {
    Form: { section: 'Form', default: Form }
  }
})
</script>
