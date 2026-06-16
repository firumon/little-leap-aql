<template>
  <div v-if="displayedReports.length">
    <!-- Non-inline mode: wrapped in a nice flat bordered card -->
    <q-card v-if="!isInline" flat bordered class="report-bar-card q-mt-sm">
      <q-card-section :class="[innerClass, 'q-pa-sm']">
        <div class="row items-center q-gutter-xs">
          <q-btn
            v-for="report in displayedReports"
            :key="report.name"
            unelevated no-caps dense
            :icon="report.icon || 'picture_as_pdf'"
            :label="report.label || report.name"
            color="deep-orange-7"
            class="report-btn"
            :loading="isGenerating"
            :disable="isGenerating"
            @click="initiateReport(report, activeRecord)"
          >
            <q-tooltip>{{ report.label || report.name }}</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <!-- Inline mode: just buttons rendered directly in a row -->
    <div v-else class="row items-center q-gutter-xs">
      <q-btn
        v-for="report in displayedReports"
        :key="report.name"
        unelevated no-caps dense
        :icon="report.icon || 'picture_as_pdf'"
        :label="report.label || report.name"
        color="deep-orange-7"
        class="report-btn"
        :loading="isGenerating"
        :disable="isGenerating"
        @click="initiateReport(report, activeRecord)"
      >
        <q-tooltip>{{ report.label || report.name }}</q-tooltip>
      </q-btn>
    </div>

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
</template>

<script setup>
import { computed } from 'vue'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useDataStore } from 'src/stores/data'
import { useReports } from 'src/composables/reports/useReports'

defineOptions({ name: 'ResourceReports' })

const props = defineProps({
  record: {
    type: Object,
    default: null
  },
  inline: {
    type: Boolean,
    default: null
  }
})

const { scope, config, resourceName, code } = useResourceConfig()
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

const isInline = computed(() => {
  if (props.inline !== null) return props.inline
  return !!activeRecord.value
})

const innerClass = computed(() => {
  return scope.value === 'operations' ? 'action-bar' : 'report-bar-inner'
})

const displayedReports = computed(() => {
  if (activeRecord.value) {
    return getRecordReports(config.value)
  } else {
    return getToolbarReports(config.value)
  }
})
</script>

<style scoped>
.report-bar-card {
  border-radius: 16px;
  border-color: var(--master-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

.report-bar-inner,
.action-bar {
  background: #f8fafc;
}

.report-btn {
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 4px 14px;
}

@keyframes rise-in {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
