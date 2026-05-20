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

    <MasterListToolbar
      :search-term="searchTerm"
      @update:search-term="searchTerm = $event"
    />

    <q-card flat bordered class="records-card q-mt-sm">
      <q-card-section v-if="loading && !displayedItems.length" class="q-py-xl text-center">
        <q-spinner-dots color="primary" size="32px" />
      </q-card-section>

      <q-card-section v-else-if="!displayedItems.length" class="q-py-xl text-center">
        <q-icon name="sell" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">No price lists found</div>
      </q-card-section>

      <q-card-section v-else class="q-pa-sm q-pa-md">
        <div class="column q-gutter-sm">
          <q-card
            v-for="row in displayedItems"
            :key="row.Code"
            flat
            bordered
            class="pl-card"
          >
            <q-expansion-item
              :model-value="isPriceListExpanded(row.Code)"
              class="pl-expansion"
              expand-icon="expand_more"
              expanded-icon="expand_less"
              @update:model-value="setPriceListExpanded(row.Code, $event)"
            >
              <template #header>
                <div class="row items-center no-wrap full-width">
                  <div class="col">
                    <div class="text-caption text-grey-6">{{ row.Code }}</div>
                    <div class="text-subtitle1 text-weight-bold">{{ row.Name || '(Unnamed)' }}</div>
                    <div class="row q-gutter-xs q-mt-xs">
                      <q-badge outline :color="row.Status === 'Active' ? 'positive' : 'grey-6'">
                        {{ row.Status || 'Active' }}
                      </q-badge>
                      <q-badge v-if="row.Currency" outline color="primary">{{ row.Currency }}</q-badge>
                      <q-badge v-if="row.IsDefault === 'TRUE'" outline color="orange">Default</q-badge>
                    </div>
                  </div>
                </div>
              </template>

              <q-separator />
              <q-card-section v-if="editingHeader" class="q-pa-sm q-pa-md">
                <div class="text-subtitle2 text-weight-medium q-mb-sm">Price List Details</div>
                <div class="row q-col-gutter-sm q-mb-md">
                  <div class="col-12 col-md-6">
                    <q-input v-model="editingHeader.Name" outlined dense label="Name *" />
                  </div>
                  <div class="col-12 col-md-6">
                    <q-select
                      :model-value="editingHeader.Status"
                      outlined dense emit-value map-options
                      :options="statusOptions"
                      label="Status"
                      @update:model-value="updateHeaderField('Status', $event)"
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <q-input v-model="editingHeader.Currency" outlined dense label="Currency *" />
                  </div>
                  <div class="col-12 col-md-6">
                    <q-select
                      :model-value="editingHeader.IsDefault"
                      outlined dense emit-value map-options
                      :options="defaultOptions"
                      label="Is Default"
                      @update:model-value="updateHeaderField('IsDefault', $event)"
                    />
                  </div>
                  <div class="col-12">
                    <q-input
                      v-model="editingHeader.Description"
                      outlined dense type="textarea" autogrow label="Description"
                    />
                  </div>
                </div>

                <div class="text-subtitle2 text-weight-medium q-mb-sm">SKU Prices</div>
                <div v-for="group in safeGroupedSkus" :key="group.productCode" class="q-mb-md">
                  <div class="text-weight-medium text-grey-8 q-mb-xs">{{ group.productName }}</div>
                  <div class="row q-col-gutter-sm">
                    <div
                      v-for="sku in group.skus"
                      :key="sku.skuCode"
                      class="col-12 col-md-6 col-lg-4"
                    >
                      <q-input
                        :model-value="getPrice(sku.skuCode)"
                        outlined dense
                        type="number"
                        step="0.01"
                        :label="sku.variantLabel"
                        @update:model-value="updatePriceField(sku.skuCode, $event)"
                      />
                    </div>
                  </div>
                </div>

                <div class="row justify-end q-mt-sm q-gutter-sm">
                  <q-btn flat no-caps label="Cancel" @click="collapsePriceList()" />
                  <q-btn
                    color="primary"
                    unelevated
                    no-caps
                    label="Save"
                    :loading="saving"
                    :disable="!(headerChanged || pricesChanged)"
                    @click="handleSave"
                  />
                </div>
              </q-card-section>
            </q-expansion-item>
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
        <q-tooltip>Add Price List</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import MasterListHeader from 'components/Masters/_common/MasterListHeader.vue'
import MasterListToolbar from 'components/Masters/_common/MasterListToolbar.vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { usePriceListEditor } from 'src/composables/masters/priceLists/usePriceListEditor'
import { useResourceIoStore } from 'src/stores/resourceIo'

const nav = useResourceNav()
const { config, resourceName, permissions } = useResourceConfig()
const resourceIoStore = useResourceIoStore()
const { items, searchTerm } = useResourceData(resourceName)
const loading = ref(false)
const backgroundSyncing = ref(false)
const {
  editingHeader,
  headerChanged,
  pricesChanged,
  saving,
  priceListLookupMode,
  groupedSkus,
  isPriceListExpanded,
  setPriceListExpanded,
  collapsePriceList,
  updateHeaderField,
  updatePriceField,
  getPrice,
  saveSection
} = usePriceListEditor()

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' }
]

const defaultOptions = [
  { label: 'Yes', value: 'TRUE' },
  { label: 'No', value: 'FALSE' }
]

const safeGroupedSkus = computed(() => {
  const groups = groupedSkus.value || []
  return Array.isArray(groups) ? groups.filter((group) => group && group.productCode) : []
})

const displayedItems = computed(() => {
  const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
  if (!keyword) return items.value
  return items.value.filter((row) => {
    const aggregate = Object.values(row || {})
      .map((v) => (v ?? '').toString().toLowerCase())
      .join(' ')
    return aggregate.includes(keyword)
  })
})

async function reloadAll() {
  const resources = [
    resourceName.value || 'PriceList',
    'Products',
    'SKUs',
    ...(priceListLookupMode.value === 'ITEMS' ? ['PriceListItems'] : [])
  ]
  const hasRowsToShow = items.value.length > 0
  loading.value = !hasRowsToShow
  backgroundSyncing.value = hasRowsToShow
  try {
    await resourceIoStore.fetchResources(resources)
  } finally {
    loading.value = false
    backgroundSyncing.value = false
  }
}

function navigateToAdd() {
  nav.goTo('add')
}

async function handleSave() {
  try {
    await saveSection()
  } catch (err) {
    console.error(err)
  }
}

watch(
  () => [resourceName.value, priceListLookupMode.value],
  async ([name]) => {
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

.pl-card {
  border-radius: 12px;
  border-color: #dce5ef;
  transition: box-shadow 200ms ease;
}

.pl-card:hover {
  box-shadow: 0 6px 16px rgba(15, 118, 110, 0.10);
}

.pl-expansion :deep(.q-item) {
  padding: 8px 16px;
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
