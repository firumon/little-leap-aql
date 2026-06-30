<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback template -->
  <div v-else class="index-content">
    <!-- Records is statically imported, handles self-override internally -->
    <Records
      :items="finalProps.items"
      :resolved-fields="finalProps.resolvedFields"
      :resource-slug="finalProps.resourceSlug"
      :customUIName="finalProps.customUIName"
      :records-config="finalProps.recordsConfig"
      :page="page"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import Records from 'components/_common/Content/Records.vue'

defineOptions({ name: 'IndexContent' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { resourceSlug, scope, resolvedFields, customUIName } = inject('resourceConfig')
const { filteredItems } = inject('resourceRecord')

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Content',
  page: props.page
})

const preparedProps = computed(() => ({
  items: filteredItems.value,
  resolvedFields: resolvedFields.value,
  resourceSlug: resourceSlug.value,
  customUIName: customUIName.value,
  recordsConfig: {}
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
