<template>
  <div class="list-page">
    <MasterHeader
      :config="config"
      :filtered-count="filteredItems.length"
      :total-count="items.length"
      :loading="loading"
      :background-syncing="backgroundSyncing"
      :reports="config?.reports || []"
      :is-generating="isGenerating"
      @reload="reload(true)"
      @generate-report="(report) => initiateReport(report)"
    />

    <MasterToolbar
      :search-term="searchTerm"
      @update:search-term="searchTerm = $event"
    />

    <q-card flat bordered class="records-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div v-if="loading" class="q-py-lg text-center text-grey-7">
          <q-spinner-dots color="primary" size="32px" />
        </div>
        <div v-else-if="!filteredItems.length" class="empty-state">
          <q-icon name="inventory_2" size="30px" />
          <div>No records found</div>
        </div>
        <div v-else class="card-list q-gutter-sm">
          <div
            v-for="row in filteredItems"
            :key="row.Code"
            class="record-card"
            @click="navigateToView(row)"
          >
            <div class="row items-center justify-between q-col-gutter-sm q-pa-sm">
              <div class="col">
                <div class="record-code">{{ row.Code }}</div>
                <div class="record-name">{{ resolvePrimaryText(row) }}</div>
                <div class="record-secondary">{{ resolveSecondaryText(row) }}</div>
                <div v-if="childCountMap[row.Code]" class="record-children">
                  <q-badge
                    v-for="(count, childName) in childCountMap[row.Code]"
                    :key="childName"
                    outline
                    color="primary"
                    class="q-mr-xs"
                  >
                    {{ count }} {{ childName }}
                  </q-badge>
                </div>
              </div>
              <q-badge
                :color="row.Status === 'Active' ? 'positive' : 'grey-6'"
                class="status-badge"
              >
                {{ row.Status || 'Unknown' }}
              </q-badge>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- FAB for Add -->
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
</template>

<script setup>
import { watch, computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MasterHeader from 'src/components/Masters/MasterHeader.vue'
import MasterToolbar from 'src/components/Masters/MasterToolbar.vue'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useResourceRelations } from 'src/composables/useResourceRelations'
import { useReports } from 'src/composables/useReports'

const router = useRouter()
const { scope, resourceSlug, config, resourceName, resolvedFields, permissions } = useResourceConfig()
const { items, filteredItems, loading, backgroundSyncing, searchTerm, reload } = useResourceData(resourceName)
const { childResources } = useResourceRelations(resourceName)

const {
  isGenerating, showReportDialog, activeReport, reportInputs,
  initiateReport, confirmReportDialog, cancelReportDialog
} = useReports(resourceName)

// Child count tracking
const childCountMap = ref({})

function resolvePrimaryText(row) {
  if (!row || typeof row !== 'object') return '-'
  if (row.Name) return row.Name
  const firstFilled = resolvedFields.value.find((field) => {
    const value = row[field.header]
    return value !== undefined && value !== null && value.toString().trim() !== '' && field.header !== 'Status'
  })
  return firstFilled ? row[firstFilled.header] : '-'
}

function resolveSecondaryText(row) {
  if (!row || typeof row !== 'object') return ''
  const field = resolvedFields.value.find((entry) => {
    if (entry.header === 'Status') return false
    if (row.Name && entry.header === 'Name') return false
    const value = row[entry.header]
    return value !== undefined && value !== null && value.toString().trim() !== ''
  })
  return field ? row[field.header] : ''
}

function navigateToView(row) {
  router.push(`/${scope.value}/${resourceSlug.value}/${row.Code}`)
}

function navigateToAdd() {
  router.push(`/${scope.value}/${resourceSlug.value}/add`)
}

// Compute child counts per parent record
function computeChildCounts() {
  if (!childResources.value.length || !items.value.length) {
    childCountMap.value = {}
    return
  }
  // Child counts will be populated when child data is available
  // For now, this is a placeholder — actual counts require child data loading
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
.records-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

.empty-state {
  text-align: center;
  color: #667085;
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 20px 10px;
}

.card-list {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 600px) {
  .card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.record-card {
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid #d9e4f0;
  background: linear-gradient(175deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 6px 16px rgba(23, 37, 61, 0.08);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.record-card:active { transform: scale(0.995); }
.record-card:hover { box-shadow: 0 10px 24px rgba(23, 37, 61, 0.12); }

.record-code { font-size: 12px; color: var(--master-soft-ink); letter-spacing: 0.03em; }
.record-name { margin-top: 2px; font-size: 16px; font-weight: 700; color: var(--master-ink); }
.record-secondary { margin-top: 3px; font-size: 12px; color: #64748b; }
.record-children { margin-top: 6px; }
.status-badge { border-radius: 8px; font-weight: 600; padding: 2px 9px; }

.fab-btn {
  width: 58px;
  height: 58px;
  box-shadow: 0 12px 24px rgba(15, 118, 110, 0.35);
  background: linear-gradient(145deg, var(--master-primary), var(--master-primary-700));
}

.fab-sticky { z-index: 30; }

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
