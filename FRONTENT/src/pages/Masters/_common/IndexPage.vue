<template>
  <div class="index-page" v-if="sectionsReady">
    <component
      :is="sections.ListHeader"
      :config="config"
      :filtered-count="displayedItems.length"
      :total-count="items.length"
      :loading="loading"
      :background-syncing="backgroundSyncing"
      @reload="reload(true)"
    />

    <component
      :is="sections.ListReportBar"
      :reports="config?.reports || []"
      :is-generating="isGenerating"
      @generate-report="(report) => initiateReport(report)"
    />

    <component
      :is="sections.ListToolbar"
      :search-term="searchTerm"
      @update:search-term="searchTerm = $event"
    />

    <component
      :is="sections.ListViewSwitcher"
      :views="effectiveViews"
      :active-view-name="activeViewName"
      :counts="viewCounts"
      @update:active-view-name="setActiveView"
    />

    <component
      :is="sections.ListRecords"
      :items="displayedItems"
      :loading="loading"
      :resolved-fields="resolvedFields"
      :child-count-map="childCountMap"
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

    <ReportInputDialog
      v-model="showReportDialog"
      :report="activeReport"
      :form-values="reportInputs"
      :is-generating="isGenerating"
      @update:form-values="reportInputs = $event"
      @confirm="confirmReportDialog"
      @cancel="cancelReportDialog"
    />
  </div>
  <div v-else class="index-page-loading">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import MasterListHeader from 'src/components/Masters/MasterListHeader.vue'
import MasterListReportBar from 'src/components/Masters/MasterListReportBar.vue'
import MasterListToolbar from 'src/components/Masters/MasterListToolbar.vue'
import MasterListRecords from 'src/components/Masters/MasterListRecords.vue'
import MasterListViewSwitcher from 'src/components/Masters/MasterListViewSwitcher.vue'
import { useSectionResolver } from 'src/composables/useSectionResolver'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { useReports } from 'src/composables/useReports'
import { useListViews } from 'src/composables/useListViews'

const router = useRouter()
const { scope, resourceSlug, config, resourceName, resourceHeaders, resolvedFields, permissions } = useResourceConfig()
const { items, loading, backgroundSyncing, searchTerm, reload } = useResourceData(resourceName)
const { childResources } = useResourceRelations(resourceName)

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

const customUIName = computed(() => config.value?.ui?.customUIName || '')
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  sectionDefs: {
    ListHeader: MasterListHeader,
    ListReportBar: MasterListReportBar,
    ListToolbar: MasterListToolbar,
    ListViewSwitcher: MasterListViewSwitcher,
    ListRecords: MasterListRecords
  }
})

const {
  isGenerating, showReportDialog, activeReport, reportInputs,
  initiateReport, confirmReportDialog, cancelReportDialog
} = useReports(resourceName)

const childCountMap = ref({})

function navigateToView(row) {
  router.push(`/${scope.value}/${resourceSlug.value}/${row.Code}`)
}

function navigateToAdd() {
  router.push(`/${scope.value}/${resourceSlug.value}/add`)
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
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.35);
  background: linear-gradient(145deg, var(--master-primary), var(--master-primary-700));
}

.fab-sticky { z-index: 30; }
</style>
