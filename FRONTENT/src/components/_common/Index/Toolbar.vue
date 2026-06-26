<template>
  <div class="index-toolbar q-gutter-y-sm" v-if="sectionsReady">
    <!-- Search Input Control -->
    <component
      :is="sections.SearchInput"
      :search-term="searchTerm"
      @update:search-term="updateSearch"
    />

    <!-- View Switcher Tabs Control -->
    <component
      :is="sections.ViewSwitcher"
      :views="effectiveViews"
      :active-view-name="activeViewName"
      :counts="viewCounts"
      @update:active-view-name="setActiveView"
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

defineOptions({ name: 'IndexToolbar' })

const { resourceSlug, scope, resourceHeaders, config } = inject('resourceConfig')
const { records: items, searchTerm } = inject('resourceRecord')

// Resolve Toolbar sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index/Toolbar',
  sectionDefs: {
    SearchInput: { section: 'SearchInput', default: 'src/components/_common/SearchInput.vue' },
    ViewSwitcher: { section: 'ViewSwitcher', default: 'src/components/_common/ViewSwitcher.vue' }
  }
})

const configuredListViews = computed(() => config.value?.ui?.listViews || [])
const configuredListViewsMode = computed(() => config.value?.ui?.listViewsMode || '')

const { effectiveViews, activeViewName, viewCounts, setActiveView } = useListViews({
  items,
  resourceHeaders,
  configuredListViews,
  configuredListViewsMode,
  enableUrlSync: false
})

function updateSearch(val) {
  searchTerm.value = val
}
</script>
