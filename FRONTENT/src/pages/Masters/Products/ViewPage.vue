<template>
  <div class="view-page">
    <div v-if="loading" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <q-card v-else-if="!record" flat bordered class="page-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="search_off" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">Record not found</div>
        <q-btn flat color="primary" label="Back to List" icon="arrow_back" class="q-mt-md" @click="navigateToList" />
      </q-card-section>
    </q-card>

    <template v-else>
      <q-card flat bordered class="page-card">
        <q-card-section class="q-pa-sm q-pa-md">
          <div class="row items-start no-wrap">
            <div class="col">
              <div class="text-caption text-grey-6">{{ record.Code }}</div>
              <div class="text-h6 text-weight-bold">{{ record.Name || '(Unnamed Product)' }}</div>
              <div class="q-mt-sm">
                <q-chip
                  v-for="variant in variantColumns"
                  :key="variant.key"
                  dense
                  square
                  color="teal-1"
                  text-color="teal-10"
                  class="q-mr-xs q-mb-xs"
                >
                  {{ variant.label }}
                </q-chip>
                <span v-if="!variantColumns.length" class="text-caption text-grey-6">No variant types</span>
              </div>
            </div>
            <q-badge :color="(record.Status || 'Active') === 'Active' ? 'positive' : 'grey-6'" outline>
              {{ record.Status || 'Active' }}
            </q-badge>
          </div>
        </q-card-section>
      </q-card>

      <MasterViewActionBar
        :permissions="permissions"
        :additional-actions="[]"
        :reports="config?.reports || []"
        :is-generating="isGenerating"
        @edit="navigateToEdit"
        @generate-report="(report) => initiateReport(report, record)"
      />

      <q-card flat bordered class="page-card q-mt-sm">
        <q-card-section class="q-pa-sm q-pa-md">
          <div class="text-subtitle2 text-weight-medium q-mb-sm">SKU Variants</div>
          <q-table
            :rows="skuRows"
            :columns="skuColumns"
            row-key="Code"
            flat
            bordered
            :loading="skuLoading"
            :rows-per-page-options="[0]"
            hide-pagination
          >
            <template #body-cell="props">
              <q-td :props="props">
                {{ props.value || '-' }}
              </q-td>
            </template>
            <template #no-data>
              <div class="full-width text-center q-py-lg text-grey-7">No SKU records</div>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <MasterViewAudit :record="record" class="q-mt-sm" />
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
import { computed, ref, watch } from 'vue'
import MasterViewActionBar from 'components/Masters/_common/MasterViewActionBar.vue'
import MasterViewAudit from 'components/Masters/_common/MasterViewAudit.vue'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import { useProductVariants } from 'src/composables/useProductVariants'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useReports } from 'src/composables/useReports'
import { useResourceNav } from 'src/composables/useResourceNav'
import { useDataStore } from 'src/stores/data'

const nav = useResourceNav()
const dataStore = useDataStore()
const { code, config, resourceName, permissions } = useResourceConfig()
const { items, loading: resourceLoading, reload } = useResourceData(resourceName)
const {
  isGenerating, showReportDialog, activeReport, reportInputs,
  initiateReport, confirmReportDialog, cancelReportDialog
} = useReports(resourceName)

const skuRows = ref([])
const skuLoading = ref(false)

const record = computed(() => {
  if (!code.value || !Array.isArray(items.value)) return null
  return items.value.find((row) => row.Code === code.value) || null
})

const { variantColumns } = useProductVariants(record)

const skuColumns = computed(() => {
  const fixedColumns = [
    { name: 'Code', label: 'SKU Code', field: 'Code', align: 'left' },
    ...variantColumns.value.map((column) => ({
      name: column.key,
      label: column.label,
      field: column.key,
      align: 'left'
    })),
    { name: 'Status', label: 'Status', field: 'Status', align: 'left' }
  ]
  return fixedColumns
})

const loading = computed(() => resourceLoading.value)

function applySkuRows(records = []) {
  skuRows.value = records.filter((row) => row.ProductCode === code.value)
}

async function syncSkuRowsInBackground() {
  try {
    const response = await dataStore.syncResource('SKUs', {
      includeInactive: true,
      syncWhenCacheExists: true
    })
    if (response.success && Array.isArray(response.records)) {
      applySkuRows(response.records)
    }
  } finally {
    skuLoading.value = false
  }
}

async function loadSkuRows() {
  if (!code.value) return
  skuLoading.value = true
  try {
    const response = await dataStore.loadResource('SKUs', {
      includeInactive: true
    })
    if (response.success && Array.isArray(response.records)) {
      applySkuRows(response.records)
      if (response?.meta?.source === 'cache') {
        syncSkuRowsInBackground()
        return
      }
    } else {
      skuRows.value = []
    }
  } finally {
    if (!skuLoading.value) return
    skuLoading.value = false
  }
}

async function loadView() {
  await reload()
  await loadSkuRows()
}

function navigateToList() {
  nav.goTo('list')
}

function navigateToEdit() {
  nav.goTo('edit')
}

watch(
  () => [resourceName.value, code.value],
  async ([name, currentCode]) => {
    if (!name || !currentCode) return
    await loadView()
  },
  { immediate: true }
)
</script>

<style scoped>
.view-page {
  display: grid;
  gap: 8px;
}

.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
}
</style>
