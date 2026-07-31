<template>
  <component
    :is="resolvedComponent"
    v-slot="{ record, page }"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <template v-else-if="displayedReports.length > 0">
    <PageSticky :page="page" position="bottom-left" :offset="[18, 18]">
      <ReportFab
        :page="page"
        :is-generating="isGenerating"
        :reports-count="displayedReports.length"
      >
        <ReportItem
          v-for="report in displayedReports"
          :key="report.name"
          :page="page"
          :report="report"
          @click="initiateReport(report, activeRecord)"
        />
      </ReportFab>
    </PageSticky>

    <ReportInputDialog
      v-model="showReportDialog"
      :report="activeReport"
      :form-values="reportInputs"
      :is-generating="isGenerating"
      @update:form-values="reportInputs = $event"
      @confirm="confirmReportDialog"
      @cancel="cancelReportDialog"
    />
  </template>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useDataStore } from 'src/stores/data'
import { useReports } from 'src/composables/reports/useReports'
import ReportInputDialog from 'src/components/app/ReportInputDialog.vue'

import PageSticky from 'components/_common/sections/Action/Downloads/PageSticky.vue'
import ReportFab from 'components/_common/sections/Action/Downloads/ReportFab.vue'
import ReportItem from 'components/_common/sections/Action/Downloads/ReportItem.vue'

defineOptions({ name: 'DownloadsFAB' })

const props = defineProps({
  record: { type: Object, default: null },
  page: { type: String, default: 'Index' }
})

const { resourceName, config } = inject('resourceConfig') || useResourceConfig()
const { code } = useRouteConfig()
const dataStore = useDataStore()

const activeRecord = computed(() => {
  if (props.record) return props.record
  if (!code.value || !resourceName.value) return null
  return dataStore.getRecords(resourceName.value).find((r) => r.Code === code.value) || null
})

const {
  isGenerating,
  showReportDialog,
  activeReport,
  reportInputs,
  getToolbarReports,
  getRecordReports,
  initiateReport,
  confirmReportDialog,
  cancelReportDialog
} = useReports(resourceName)

const displayedReports = computed(() => {
  if (activeRecord.value) {
    return getRecordReports(config.value)
  } else {
    return getToolbarReports(config.value)
  }
})

const preparedProps = computed(() => ({
  record: props.record,
  page: props.page,
  displayedReports: displayedReports.value,
  isGenerating: isGenerating.value
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'Downloads',
  page: props.page,
  preparedProps
})
</script>

