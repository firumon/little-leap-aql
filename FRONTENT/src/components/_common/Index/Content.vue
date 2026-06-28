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
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useListViews } from 'src/composables/useListViews'
import Records from 'components/_common/Content/Records.vue'

defineOptions({ name: 'IndexContent' })

const { resourceSlug, scope, resourceHeaders, resolvedFields, customUIName, config } = inject('resourceConfig')
const { records: items, searchTerm } = inject('resourceRecord')

// Resolve Content sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index/Content',
  sectionDefs: {
    Records: { section: 'Records', default: Records }
  }
})

const configuredListViews = computed(() => config.value?.ui?.listViews || [])
const configuredListViewsMode = computed(() => config.value?.ui?.listViewsMode || '')

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
