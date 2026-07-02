<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @update:field="(header, val) => $emit('update:field', header, val)"
    @add-child="(slug) => $emit('add-child', slug)"
    @remove-child="(slug, idx) => $emit('remove-child', slug, idx)"
    @update-child-field="(slug, idx, header, val) => $emit('update-child-field', slug, idx, header, val)"
  />

  <!-- Fallback template -->
  <div v-else class="edit-content">
    <!-- Form is statically imported, handles self-override internally -->
    <Form
      :config="config"
      :resolved-fields="resolvedFields"
      :parent-form="finalProps.parentForm"
      :child-groups="finalProps.childGroups"
      :status-options="finalProps.statusOptions"
      :form-config="finalProps.formConfig"
      :page="page"
      @update:field="(header, val) => $emit('update:field', header, val)"
      @add-child="(slug) => $emit('add-child', slug)"
      @remove-child="(slug, idx) => $emit('remove-child', slug, idx)"
      @update-child-field="(slug, idx, header, val) => $emit('update-child-field', slug, idx, header, val)"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import Form from 'components/_common/sections/Content/Form.vue'

defineOptions({ name: 'EditContent' })

const props = defineProps({
  parentForm: Object,
  childGroups: Object,
  statusOptions: Array,
  page: { type: String, default: 'Edit' }
})

defineEmits([
  'update:field',
  'add-child',
  'remove-child',
  'update-child-field'
])

const { resourceSlug, scope, config, resolvedFields, customUIName } = inject('resourceConfig')

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Content',
  page: props.page
})

const preparedProps = computed(() => ({
  parentForm: props.parentForm,
  childGroups: props.childGroups,
  statusOptions: props.statusOptions,
  formConfig: {}
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
