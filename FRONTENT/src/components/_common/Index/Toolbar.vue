<template>
  <div class="index-toolbar q-gutter-y-sm" v-if="sectionsReady">
    <!-- Search Input Control (resolved at Index level, self-binding via inject) -->
    <component :is="searchSections.SearchInput" page="Index" />

    <!-- View Switcher Tabs Control -->
    <component
      :is="toolbarSections.ViewSwitcher"
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
import SearchInput from 'components/_common/Toolbar/SearchInput.vue'
import ViewSwitcher from 'components/_common/Toolbar/ViewSwitcher.vue'

defineOptions({ name: 'IndexToolbar' })

const { resourceSlug, scope, resourceHeaders, config } = inject('resourceConfig')
const { records: items } = inject('resourceRecord')

// Resolve ViewSwitcher at Index page level
const { sections: toolbarSections, sectionsReady: toolbarReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index',
  sectionDefs: {
    ViewSwitcher: { section: 'ViewSwitcher', default: ViewSwitcher }
  }
})

// Resolve SearchInput at Index level to allow components/[Scope]/[ResourceName]/Index/SearchInput.vue
const { sections: searchSections, sectionsReady: searchReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Index',
  sectionDefs: {
    SearchInput: { section: 'SearchInput', default: SearchInput }
  }
})

const sectionsReady = computed(() => toolbarReady.value && searchReady.value)

const configuredListViews = computed(() => config.value?.ui?.listViews || [])
const configuredListViewsMode = computed(() => config.value?.ui?.listViewsMode || '')

const { effectiveViews, activeViewName, viewCounts, setActiveView } = useListViews({
  items,
  resourceHeaders,
  configuredListViews,
  configuredListViewsMode,
  enableUrlSync: false
})
</script>
