<template>
  <div class="list-page" v-if="sectionsReady">
    <component
      :is="HeaderComponent"
      :config="config"
      :filtered-count="filteredItems.length"
      :total-count="items.length"
      :loading="loading"
      :background-syncing="backgroundSyncing"
      @reload="reload(true)"
    />

    <component
      :is="ReportBarComponent"
      :reports="config?.reports || []"
      :is-generating="isGenerating"
      @generate-report="(report) => initiateReport(report)"
    />

    <component
      :is="ToolbarComponent"
      :search-term="searchTerm"
      @update:search-term="searchTerm = $event"
    />

    <component
      :is="RecordsComponent"
      :items="filteredItems"
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
  <div v-else class="list-page-loading">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import { useListSectionResolver } from 'src/composables/useListSectionResolver'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { useReports } from 'src/composables/useReports'

const router = useRouter()
const { scope, resourceSlug, config, resourceName, resolvedFields, permissions } = useResourceConfig()
const { items, filteredItems, loading, backgroundSyncing, searchTerm, reload } = useResourceData(resourceName)
const { childResources } = useResourceRelations(resourceName)
const { HeaderComponent, ReportBarComponent, ToolbarComponent, RecordsComponent, sectionsReady } = useListSectionResolver(resourceSlug)

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
.list-page {
  display: grid;
  gap: 8px;
}

.list-page-loading {
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
