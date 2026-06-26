<template>
  <div class="view-content q-gutter-y-md" v-if="sectionsReady">
    <!-- 1. Record Details Grid -->
    <component
      :is="sections.Details"
    />

    <!-- 2. Parent Link Card (if in Operations scope or if parent exists) -->
    <component
      v-if="isOperations && parentRecord"
      :is="sections.Parent"
    />

    <!-- 3. Child Resources Grids/Tables -->
    <component
      v-if="childResources.length"
      :is="sections.Children"
    />

    <!-- 4. Audit Trail Metadata (if in Masters scope) -->
    <component
      v-if="isMasters"
      :is="sections.Audit"
    />
  </div>
  <div v-else class="flex flex-center q-py-md">
    <q-spinner-dots color="primary" size="24px" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'ViewContent' })

const { config, scope } = inject('resourceConfig')
const {
  record, parentResource, childResources, childRecordsByResource
} = inject('resourceRecord')

const isMasters = computed(() => scope.value?.toLowerCase() === 'masters')
const isOperations = computed(() => scope.value?.toLowerCase() === 'operations')

const parentRecord = computed(() => {
  const pKeys = record.value?._Parents || []
  if (pKeys.length) return record.value?.[pKeys[0]] || null
  return null
})

// Resolve View page content sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug: config.value?.slug,
  scope: config.value?.scope,
  page: 'View/Content',
  sectionDefs: {
    Details: { section: 'Details', default: 'src/components/_common/Details.vue' },
    Parent: { section: 'Parent', default: 'src/components/_common/Parent.vue' },
    Children: { section: 'Children', default: 'src/components/_common/Children.vue' },
    Audit: { section: 'Audit', default: 'src/components/_common/Audit.vue' }
  }
})
</script>
