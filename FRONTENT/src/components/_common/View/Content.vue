<template>
  <div class="view-content q-gutter-y-md" v-if="sectionsReady">
    <!-- 1. Record Details Grid -->
    <component
      :is="sections.Details"
      :config="config"
      :record="record"
    />

    <!-- 2. Parent Link Card (if in Operations scope or if parent exists) -->
    <component
      v-if="isOperations && parentRecord"
      :is="sections.Parent"
      :parent-resource="parentResource"
      :parent-record="parentRecord"
      :config="config"
      :record="record"
    />

    <!-- 3. Child Resources Grids/Tables -->
    <component
      v-if="childResources.length"
      :is="sections.Children"
      :child-resources="childResources"
      :child-records-map="childRecordsByResource"
      :config="config"
      :record="record"
    />

    <!-- 4. Audit Trail Metadata (if in Masters scope) -->
    <component
      v-if="isMasters"
      :is="sections.Audit"
      :config="config"
      :record="record"
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

const props = defineProps({
  config: Object,
  record: Object
})

const {
  parentResource, childResources, childRecordsByResource
} = inject('resourceRecord')

const isMasters = computed(() => props.config?.scope?.toLowerCase() === 'masters')
const isOperations = computed(() => props.config?.scope?.toLowerCase() === 'operations')

const parentRecord = computed(() => {
  const pKeys = props.record?._Parents || []
  if (pKeys.length) return props.record?.[pKeys[0]] || null
  return null
})

// Resolve View page content sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug: props.config?.slug,
  scope: props.config?.scope,
  page: 'View/Content',
  sectionDefs: {
    Details: { section: 'Details', default: 'src/components/_common/Details.vue' },
    Parent: { section: 'Parent', default: 'src/components/_common/Parent.vue' },
    Children: { section: 'Children', default: 'src/components/_common/Children.vue' },
    Audit: { section: 'Audit', default: 'src/components/_common/Audit.vue' }
  }
})
</script>
