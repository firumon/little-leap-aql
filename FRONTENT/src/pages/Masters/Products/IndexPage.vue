<template>
  <div class="index-page">
    <MasterListHeader
      :config="config"
      :filtered-count="displayedItems.length"
      :total-count="items.length"
      :loading="loading"
      :background-syncing="backgroundSyncing"
      @reload="reloadAll(true)"
    />

    <MasterListReportBar
      :reports="config?.reports || []"
      :is-generating="isGenerating"
      @generate-report="(report) => initiateReport(report)"
    />

    <MasterListToolbar
      :search-term="searchTerm"
      @update:search-term="searchTerm = $event"
    />

    <MasterListViewSwitcher
      :views="effectiveViews"
      :active-view-name="activeViewName"
      :counts="viewCounts"
      @update:active-view-name="setActiveView"
    />

    <q-card flat bordered class="records-card q-mt-sm">
      <q-card-section v-if="loading" class="q-py-xl text-center">
        <q-spinner-dots color="primary" size="32px" />
      </q-card-section>

      <q-card-section v-else-if="!displayedItems.length" class="q-py-xl text-center">
        <q-icon name="inventory_2" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">No products found</div>
      </q-card-section>

      <q-card-section v-else class="q-pa-sm q-pa-md">
        <div class="column q-gutter-sm">
          <q-card
            v-for="row in displayedItems"
            :key="row.Code"
            flat
            bordered
            class="product-card"
            @click="navigateToView(row)"
          >
            <q-card-section class="q-pa-sm q-pa-md">
              <div class="row items-start no-wrap">
                <div class="col">
                  <div class="text-caption text-grey-6">{{ row.Code || '-' }}</div>
                  <div class="text-subtitle1 text-weight-bold q-mt-xs">{{ row.Name || '(Unnamed Product)' }}</div>
                  <div class="q-mt-sm">
                    <q-chip
                      v-for="variant in parseVariantTypes(row.VariantTypes)"
                      :key="`${row.Code}-${variant.key}`"
                      dense
                      square
                      color="teal-1"
                      text-color="teal-10"
                      class="q-mr-xs q-mb-xs"
                    >
                      {{ variant.label }}
                    </q-chip>
                    <span v-if="!parseVariantTypes(row.VariantTypes).length" class="text-caption text-grey-6">
                      No variant types
                    </span>
                  </div>
                </div>

                <div class="column items-end q-gutter-xs">
                  <q-badge color="primary" text-color="white">
                    {{ skuCountByProduct[row.Code] || 0 }} SKUs
                  </q-badge>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </q-card-section>
    </q-card>

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
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MasterListHeader from 'src/components/Masters/MasterListHeader.vue'
import MasterListReportBar from 'src/components/Masters/MasterListReportBar.vue'
import MasterListToolbar from 'src/components/Masters/MasterListToolbar.vue'
import MasterListViewSwitcher from 'src/components/Masters/MasterListViewSwitcher.vue'
import ReportInputDialog from 'src/components/Masters/ReportInputDialog.vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useReports } from 'src/composables/useReports'
import { useListViews } from 'src/composables/useListViews'
import { parseVariantTypes } from 'src/composables/useProductVariants'
import { fetchMasterRecords } from 'src/services/masterRecords'

const router = useRouter()
const { scope, resourceSlug, config, resourceName, resourceHeaders, permissions } = useResourceConfig()
const { items, loading, backgroundSyncing, searchTerm, reload } = useResourceData(resourceName)
const { isGenerating, showReportDialog, activeReport, reportInputs, initiateReport, confirmReportDialog, cancelReportDialog } = useReports(resourceName)

const configuredListViews = computed(() => config.value?.ui?.listViews || [])
const configuredListViewsMode = computed(() => config.value?.ui?.listViewsMode || '')

const { effectiveViews, activeViewName, viewCounts, viewFilteredItems, setActiveView } = useListViews({
  items,
  resourceHeaders,
  configuredListViews,
  configuredListViewsMode,
  enableUrlSync: false
})

const skuRecords = ref([])

const skuCountByProduct = computed(() => {
  const result = {}
  for (const row of skuRecords.value) {
    const productCode = (row.ProductCode || '').toString().trim()
    if (!productCode) continue
    if ((row.Status || 'Active') === 'Inactive') continue
    result[productCode] = (result[productCode] || 0) + 1
  }
  return result
})

// Final displayed items: view filter -> SKU-aware search
const displayedItems = computed(() => {
  const list = viewFilteredItems.value
  const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
  if (!keyword) return list

  return list.filter((row) => {
    const productText = [row.Code, row.Name, row.VariantTypes, row.Status]
      .map((value) => (value || '').toString().toLowerCase())
      .join(' ')
    if (productText.includes(keyword)) return true

    const productSkus = skuRecords.value.filter((sku) => {
      if ((sku.Status || 'Active') === 'Inactive') return false
      return sku.ProductCode === row.Code
    })

    const skuText = productSkus
      .map((sku) => [sku.Code, sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5]
        .map((value) => (value || '').toString().toLowerCase())
        .join(' '))
      .join(' ')

    return skuText.includes(keyword)
  })
})

async function loadSkuRecords(forceSync = false) {
  const response = await fetchMasterRecords('SKUs', {
    includeInactive: true,
    forceSync
  })
  if (response.success && Array.isArray(response.records)) {
    skuRecords.value = response.records
  } else {
    skuRecords.value = []
  }
}

async function reloadAll(forceSync = false) {
  await Promise.all([
    reload(forceSync),
    loadSkuRecords(forceSync)
  ])
}

function navigateToView(row) {
  router.push(`/${scope.value}/${resourceSlug.value}/${row.Code}`)
}

function navigateToAdd() {
  router.push(`/${scope.value}/${resourceSlug.value}/add`)
}

watch(
  () => resourceName.value,
  async (name) => {
    if (!name) return
    await reloadAll()
  },
  { immediate: true }
)
</script>

<style scoped>
.index-page {
  display: grid;
  gap: 8px;
}

.records-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
}

.product-card {
  border-radius: 12px;
  border-color: #dce5ef;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(15, 118, 110, 0.14);
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
