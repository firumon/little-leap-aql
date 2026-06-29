<template>
  <div class="index-content" v-if="sectionsReady">
    <component
      :is="sections.Records"
      :items="filteredItems"
      :resolved-fields="resolvedFields"
      :resource-slug="resourceSlug"
      :customUIName="customUIName"
    />
  </div>
  <div v-else class="flex flex-center q-py-md">
    <q-spinner-dots color="primary" size="24px" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import Records from 'components/_common/Content/Records.vue'

defineOptions({ name: 'IndexContent' })

const { resourceSlug, scope, resolvedFields, customUIName } = inject('resourceConfig')
const { filteredItems } = inject('resourceRecord')

// Resolve Content sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index/Content',
  sectionDefs: {
    Records: { section: 'Records', default: Records }
  }
})
</script>
