<template>
  <q-page class="master-page q-pa-sm q-pa-md">
    <MasterHeader
      :config="config"
      :filtered-count="filteredItems.length"
      :total-count="items.length"
      :loading="loading"
      :background-syncing="backgroundSyncing"
      @reload="reload(true)"
    />

    <MasterToolbar
      :search-term="searchTerm"
      :show-inactive="showInactive"
      :reports="config?.reports || []"
      :is-generating="isGenerating"
      @update:search-term="searchTerm = $event"
      @update:show-inactive="showInactive = $event"
      @reload="reload"
      @generate-report="(report) => initiateReport(report)"
    />

    <MasterList
      :loading="loading"
      :items="filteredItems"
      :resolve-primary-text="resolvePrimaryText"
      :resolve-secondary-text="resolveSecondaryText"
      @open-detail="openDetailDialog"
    />

    <q-page-sticky
      :key="currentResource || route.fullPath"
      position="bottom-right"
      :offset="[16, 22]"
      class="fab-sticky"
    >
      <q-btn
        round
        unelevated
        icon="add"
        color="primary"
        class="fab-btn"
        @click="openCreateDialog"
      />
    </q-page-sticky>

    <MasterDetailDialog
      v-model="showDetailDialog"
      :detail-row="detailRow"
      :detail-fields="detailFields"
      :resolve-primary-text="resolvePrimaryText"
      :reports="config?.reports || []"
      :is-generating="isGenerating"
      @edit="editFromDetail"
      @generate-report="(report, row) => initiateReport(report, row)"
    />

    <MasterEditorDialog
      v-model="showDialog"
      :is-edit="isEdit"
      :config="config"
      :form="form"
      :resolved-fields="resolvedFields"
      :status-options="statusOptions"
      :saving="saving"
      @update:form="form = $event"
      @save="save"
    />

    <ReportInputDialog
      v-model="showReportDialog"
      :report="activeReport"
      :form-values="reportInputs"
      :is-generating="isGenerating"
      @update:form-values="reportInputs = $event"
      @confirm="confirmReportDialog"
      @cancel="cancelReportDialog"
    />
  </q-page>
</template>

<script setup>
import MasterDetailDialog from 'src/components/Masters/MasterDetailDialog.vue'
import MasterEditorDialog from 'src/components/Masters/MasterEditorDialog.vue'
import MasterHeader from 'src/components/Masters/MasterHeader.vue'
import MasterList from 'src/components/Masters/MasterList.vue'
import MasterToolbar from 'src/components/Masters/MasterToolbar.vue'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import { useMasterPage } from 'src/composables/useMasterPage'
import { useReports } from 'src/composables/useReports'

const {
  route,
  currentResource,
  config,
  items,
  filteredItems,
  searchTerm,
  showInactive,
  loading,
  saving,
  backgroundSyncing,
  showDialog,
  showDetailDialog,
  isEdit,
  form,
  detailRow,
  statusOptions,
  resolvedFields,
  detailFields,
  resolvePrimaryText,
  resolveSecondaryText,
  reload,
  openCreateDialog,
  openDetailDialog,
  editFromDetail,
  save
} = useMasterPage()

const {
  isGenerating,
  showReportDialog,
  activeReport,
  reportInputs,
  initiateReport,
  confirmReportDialog,
  cancelReportDialog
} = useReports()
</script>

<style scoped>
.master-page {
  --master-font: 'Sora', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  --master-bg-1: #f8fafc;
  --master-bg-2: #eef2f7;
  --master-ink: #0f172a;
  --master-soft-ink: #51607a;
  --master-primary: #0f766e;
  --master-primary-700: #0b5d56;
  --master-surface: #ffffff;
  --master-border: #dbe3ed;

  font-family: var(--master-font);
  color: var(--master-ink);
  background:
    radial-gradient(1000px 520px at 12% -10%, #dfe8f6 0%, transparent 58%),
    radial-gradient(900px 420px at 100% -5%, #d9ece7 0%, transparent 52%),
    linear-gradient(160deg, var(--master-bg-1) 0%, var(--master-bg-2) 100%);
  min-height: 100%;
}

.fab-btn {
  width: 58px;
  height: 58px;
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.35);
  background: linear-gradient(145deg, var(--master-primary), var(--master-primary-700));
}

.fab-sticky {
  z-index: 30;
}
</style>


