<template>
  <div class="index-content" v-if="sectionsReady">
    <component
      :is="sections.Records"
      :items="displayedItems"
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
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useListViews } from 'src/composables/useListViews'

defineOptions({ name: 'IndexContent' })

const props = defineProps({
  config: Object
})

const { resourceSlug, scope, resourceHeaders, resolvedFields, customUIName } = useResourceConfig()
const { records: items, searchTerm } = useRecord()

// Resolve Content sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index/Content',
  sectionDefs: {
    Records: { section: 'Records', default: 'src/components/_common/Records.vue' }
  }
})

const configuredListViews = computed(() => props.config?.ui?.listViews || [])
const configuredListViewsMode = computed(() => props.config?.ui?.listViewsMode || '')

const { viewFilteredItems } = useListViews({
  items,
  resourceHeaders,
  configuredListViews,
  configuredListViewsMode,
  enableUrlSync: false
})

// Derive the final filtered and searched items to display
const displayedItems = computed(() => {
  const list = viewFilteredItems.value
  const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
  if (!keyword) return list
  return list.filter((row) => {
    return Object.values(row || {})
      .map((v) => (v ?? '').toString().toLowerCase())
      .join(' ')
      .includes(keyword)
  })
})
</script>
