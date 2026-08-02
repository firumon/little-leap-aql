<template>
  <div class="add-page">
    <q-card flat bordered class="page-card">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-h6 text-weight-bold">Create Price List</div>
        <div class="text-caption text-grey-6">Set header details and assign prices for products.</div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-subtitle2 text-weight-medium q-mb-sm">Price List Details</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-6">
            <q-input v-model="form.Name" outlined dense label="Name *" placeholder="e.g. Standard Retail" />
          </div>
          <div class="col-12 col-md-6">
            <q-input v-model="form.Currency" outlined dense label="Currency *" placeholder="e.g. AED" />
          </div>
          <div class="col-12 col-md-6">
            <q-select
              v-model="form.IsDefault"
              outlined dense emit-value map-options
              :options="defaultOptions"
              label="Is Default"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-select
              v-model="form.Status"
              outlined dense emit-value map-options
              :options="statusOptions"
              label="Status"
            />
          </div>
          <div class="col-12">
            <q-input v-model="form.Description" outlined type="textarea" label="Description" />
          </div>
          <div class="col-12">
            <q-select
              :model-value="copyFromCode"
              outlined
              dense
              clearable
              emit-value
              map-options
              :options="copyFromOptions"
              label="Copy prices from"
              @update:model-value="copyPricesFromPriceList"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-subtitle2 text-weight-medium q-mb-sm">SKU Prices</div>
        <div class="text-caption text-grey-6 q-mb-md">
          Enter prices for the products below. Leave blank to skip.
        </div>

        <div v-for="group in groupedSkus" :key="group.productCode" class="q-mb-md">
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
                @update:model-value="updatePrice(sku.skuCode, $event)"
              />
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="row justify-end q-gutter-sm">
        <q-btn flat no-caps label="Cancel" @click="navigateBack" />
        <q-btn color="primary" unelevated no-caps label="Create" :loading="saving" @click="handleCreate" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { usePriceListCreateForm } from 'src/composables/master/priceLists/usePriceListCreateForm'
import { useResourceIoStore } from 'src/stores/resourceIo'

const $q = useQuasar()
const nav = useResourceNav()
const { resourceName } = useResourceConfig()
const resourceIoStore = useResourceIoStore()

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' }
]

const defaultOptions = [
  { label: 'Yes', value: 'TRUE' },
  { label: 'No', value: 'FALSE' }
]

const {
  form,
  saving,
  copyFromCode,
  priceListLookupMode,
  copyFromOptions,
  groupedSkus,
  updatePrice,
  copyPricesFromPriceList,
  getPrice,
  handleSave,
  navigateBack
} = usePriceListCreateForm()

watch(
  () => [resourceName.value, priceListLookupMode.value],
  async ([name]) => {
    if (!name) return
    await resourceIoStore.fetchResources([
      'Products',
      'SKUs',
      'PriceList',
      ...(priceListLookupMode.value === 'ITEMS' ? ['PriceListItems'] : [])
    ])
  },
  { immediate: true }
)

async function handleCreate() {
  const result = await handleSave()
  if (result.success) {
    const newCode = result.data?.code || result.data?.Code || ''
    $q.notify({ type: 'positive', message: 'Price list created', timeout: 1800 })
    if (newCode) {
      nav.goTo('view', { code: newCode })
    } else {
      navigateBack()
    }
  } else {
    $q.notify({ type: 'negative', message: result.error || 'Create failed', timeout: 3000 })
  }
}
</script>

<style scoped>
.add-page {
  display: grid;
  gap: 8px;
}
</style>

