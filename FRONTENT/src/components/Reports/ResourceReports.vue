<template>
  <div v-if="shouldRender">
    <!-- Toolbar Dropdown Mode -->
    <template v-if="mode === 'toolbar'">
      <q-btn
        flat
        round
        dense
        :loading="isGenerating"
        :disable="isGenerating"
      >
        <q-avatar size="32px">
          <img src="/icons/report_download.png" alt="Reports">
        </q-avatar>
        <q-tooltip>Reports</q-tooltip>
        <q-menu auto-close>
          <q-list style="min-width: 180px" separator>
            <q-item
              v-for="report in displayedReports"
              :key="report.name"
              clickable
              v-ripple
              @click="initiateReport(report, activeRecord)"
            >
              <q-item-section side><q-icon :name="report.icon || 'picture_as_pdf'" color="primary" /></q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ report.label || report.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </template>

    <!-- FAB Mode -->
    <template v-else-if="mode === 'fab'">
      <q-fab
        color="deep-orange-7"
        icon="picture_as_pdf"
        active-icon="close"
        direction="up"
        vertical-actions-align="left"
        class="report-fab"
        :loading="isGenerating"
        :disable="isGenerating"
      >
        <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">Download Reports</q-tooltip>
        <q-fab-action
          v-for="report in displayedReports"
          :key="report.name"
          color="deep-orange-6"
          :icon="report.icon || 'picture_as_pdf'"
          :label="report.label || report.name"
          label-position="right"
          external-label
          label-class="text-weight-bold bg-white text-grey-9 q-px-sm q-py-xs shadow-1 rounded-borders"
          @click="initiateReport(report, activeRecord)"
        />
      </q-fab>
    </template>

    <!-- Standard Inline / Card Mode -->
    <template v-else>
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
    </template>

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
  },
  mode: {
    type: String,
    default: ''
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

const shouldRender = computed(() => {
  if (props.mode === 'toolbar' || props.mode === 'fab') {
    return displayedReports.value.length > 0
  }
  // For page-embedded usage, only render if a record is explicitly provided.
  // This avoids double-rendering page-level reports since they are now in the global header.
  return props.record !== null && displayedReports.value.length > 0
})
</script>

<style scoped>
.report-bar-card {
  border-radius: 16px;
  border-color: var(--aql-border, #e2e8f0);
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

.report-fab {
  box-shadow: 0 8px 24px rgba(221, 44, 0, 0.3);
  transition: transform 180ms ease;
}

.report-fab:active {
  transform: scale(0.95);
}
</style>
