<template>
  <div class="index-page" v-if="sectionsReady">
    <component
      :is="sections.Header"
      :config="config"
      :filtered-count="displayedItems.length"
      :total-count="items.length"
      :loading="loading"
      :background-syncing="backgroundSyncing"
      @reload="reload(true)"
    />

    <ResourceReports />

    <component
      :is="sections.Toolbar"
      :search-term="searchTerm"
      @update:search-term="searchTerm = $event"
    />

    <component
      :is="sections.ViewSwitcher"
      :views="effectiveViews"
      :active-view-name="activeViewName"
      :counts="viewCounts"
      @update:active-view-name="setActiveView"
    />

    <!-- List Loading State -->
    <component v-if="loading && !items.length" :is="sections.Loading" />

    <!-- List Empty State -->
    <component v-else-if="!items.length" :is="sections.Empty" />

    <component
      v-else
      :is="sections.Records"
      :items="displayedItems"
      :loading="loading"
      :resolved-fields="resolvedFields"
      :child-count-map="childCountMap"
      :resource-slug="resourceSlug"
      :custom-u-i-name="customUIName"
      @navigate-to-view="navigateToView"
    />

    <q-page-sticky position="bottom-right" :offset="[16, 22]" class="fab-sticky">
      <q-btn
        v-if="permissions.canWrite"
        round
        unelevated
        icon="add"
        color="primary"
        class="fab-btn"
        @click="navigateToAdd"
      >
        <q-tooltip>Add New</q-tooltip>
      </q-btn>
    </q-page-sticky>

  </div>
  <div v-else class="index-page-loading">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, ref, computed } from 'vue'
import ResourceReports from 'components/Reports/ResourceReports.vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useListViews } from 'src/composables/useListViews'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const nav = useResourceNav()
const { scope, resourceSlug, config, resourceName, resourceHeaders, resolvedFields, permissions, customUIName } = useResourceConfig()
const { records: items, loading, backgroundSyncing, searchTerm, reload, childResources } = useRecord()

const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope,
  sectionDefs: {
    Header: 'Header',
    Toolbar: 'Toolbar',
    ViewSwitcher: 'ViewSwitcher',
    Records: 'Records',
    Loading: 'Loading',
    Empty: 'Empty'
  }
})

const configuredListViews = computed(() => config.value?.ui?.listViews || [])
const configuredListViewsMode = computed(() => config.value?.ui?.listViewsMode || '')

const { effectiveViews, activeViewName, viewCounts, viewFilteredItems, setActiveView } = useListViews({
  items,
  resourceHeaders,
  configuredListViews,
  configuredListViewsMode,
  enableUrlSync: false
})

// Final displayed items: view filter -> search filter
const displayedItems = computed(() => {
  const list = viewFilteredItems.value
  const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
  if (!keyword) return list
  return list.filter((row) => {
    const aggregate = Object.values(row || {})
      .map((v) => (v ?? '').toString().toLowerCase())
      .join(' ')
    return aggregate.includes(keyword)
  })
})

const childCountMap = ref({})

function navigateToView(row) {
  nav.goTo('view', { code: row.Code })
}

function navigateToAdd() {
  nav.goTo('add')
}

function computeChildCounts() {
  if (!childResources.value.length || !items.value.length) {
    childCountMap.value = {}
    return
  }
  childCountMap.value = {}
}

watch(() => resourceName.value, async (newName) => {
  if (newName) {
    await reload()
    computeChildCounts()
  }
}, { immediate: true })
</script>

<style scoped>
.index-page {
  display: grid;
  gap: 8px;
}

.index-page-loading {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab-btn {
  width: 58px;
  height: 58px;
  box-shadow: 0 12px 24px rgba(15, 43, 74, 0.35);
  background: linear-gradient(145deg, var(--q-primary), var(--q-primary-dark));
}

.fab-sticky { z-index: 30; }
</style>
