<template>
  <div>
    <div class="row items-center q-gutter-sm q-mb-md">
      <q-chip removable color="primary" text-color="white" icon="warehouse" @remove="$emit('back')">
        {{ context.warehouseCode }}
      </q-chip>
      <q-chip removable color="teal" text-color="white" icon="category" @remove="$emit('back')">
        {{ context.referenceType }}
      </q-chip>
      <q-chip v-if="context.referenceCode" color="grey-7" text-color="white" icon="tag">
        {{ context.referenceCode }}
      </q-chip>
    </div>

    <div class="row items-center q-gutter-sm q-mb-sm">
      <q-select
        v-model="skuToAdd"
        :options="skuOptions"
        option-value="code"
        option-label="label"
        use-input
        clearable
        dense
        outlined
        label="Add SKU"
        style="min-width: 280px"
        @filter="filterSkus"
        @update:model-value="onAddSku"
      />
      <q-btn
        outline
        color="secondary"
        label="Load all stock in warehouse"
        icon="download"
        dense
        :loading="loadingStorages"
        @click="loadAllInWarehouse"
      />
    </div>

    <div class="q-mb-md" style="overflow-x: auto">
      <table class="stock-table full-width">
        <thead>
          <tr>
            <th class="text-left">SKU / Product</th>
            <th class="text-left">Storage</th>
            <th class="text-right">Current</th>
            <th class="text-right">Change (Δ)</th>
            <th class="text-right">New Qty</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <StockMovementRow
            v-for="row in gridRows"
            :key="row.id"
            :sku="row.sku"
            :product-name="row.productName"
            :storage-name="row.storageName"
            :storage-options="getStorageOptionsForSku(row.sku)"
            :current-qty="row.currentQty"
            :model-value="row.qtyChange"
            @update:storage-name="updateRowStorage(row, $event)"
            @update:model-value="row.qtyChange = $event"
            @remove="removeRow(row.id)"
          />
          <tr v-if="!gridRows.length">
            <td colspan="6" class="text-center text-grey-6 q-pa-md">
              Add a SKU above or load all stock rows in this warehouse.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row items-center justify-between q-mt-sm">
      <div class="text-caption text-grey-7">
        {{ gridRows.length }} row{{ gridRows.length !== 1 ? 's' : '' }} total
        &nbsp;�&nbsp;
        {{ nonZeroRows.length }} with changes
      </div>
      <div class="row q-gutter-sm">
        <q-btn flat label="Back" @click="$emit('back')" />
        <q-btn
          color="primary"
          :label="`Save ${nonZeroRows.length} Movement${nonZeroRows.length !== 1 ? 's' : ''}`"
          :loading="stockMovements.isSubmitting.value"
          :disable="!nonZeroRows.length || stockMovements.isSubmitting.value"
          @click="onSubmit"
        />
      </div>
    </div>

    <q-inner-loading :showing="stockMovements.isSubmitting.value">
      <div class="text-center">
        <q-spinner size="40px" color="primary" />
        <div class="q-mt-sm text-body2">
          Saving {{ stockMovements.progress.value.current }} / {{ stockMovements.progress.value.total }}...
        </div>
      </div>
    </q-inner-loading>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { uid, useQuasar } from 'quasar'
import { fetchMasterRecords } from 'src/services/masterRecords'
import { useStockMovements } from 'src/composables/useStockMovements'
import StockMovementRow from 'src/components/Warehouse/StockMovementRow.vue'

const props = defineProps({
  context: {
    type: Object,
    required: true
    // { warehouseCode, referenceType, referenceCode }
  }
})

const emit = defineEmits(['back', 'submitted'])

const $q = useQuasar()
const stockMovements = useStockMovements()

const storageRows = ref([])
const loadingStorages = ref(false)

const allSkus = ref([])
const skuOptions = ref([])
const skuToAdd = ref(null)

const gridRows = ref([])

const nonZeroRows = computed(() => gridRows.value.filter(r => r.qtyChange !== 0))

onMounted(async () => {
  loadingStorages.value = true
  try {
    storageRows.value = await stockMovements.loadStoragesForWarehouse(props.context.warehouseCode)
  } finally {
    loadingStorages.value = false
  }

  try {
    const skuResult = await fetchMasterRecords('SKUs')
    const productResult = await fetchMasterRecords('Products')
    const productMap = {}
    ;(productResult.records || []).forEach(p => { productMap[p.Code] = p.Name || p.Code })

    allSkus.value = (skuResult.records || [])
      .filter(s => (s.Status || 'Active') === 'Active')
      .map(s => {
        const variants = [s.Variant1, s.Variant2, s.Variant3, s.Variant4, s.Variant5]
          .filter(Boolean).join(' / ')
        const productName = productMap[s.ProductCode] || s.ProductCode || ''
        const label = variants ? `${s.Code} - ${productName} (${variants})` : `${s.Code} - ${productName}`
        return { code: s.Code, label, productName }
      })
    skuOptions.value = allSkus.value.slice()
  } catch (e) {
    allSkus.value = []
    skuOptions.value = []
  }
})

function filterSkus(val, update) {
  update(() => {
    if (!val) {
      skuOptions.value = allSkus.value.slice()
      return
    }
    const needle = val.toLowerCase()
    skuOptions.value = allSkus.value.filter(s => s.label.toLowerCase().includes(needle))
  })
}

function getStorageOptionsForSku(sku) {
  const bySku = storageRows.value
    .filter(r => r.SKU === sku)
    .map(r => r.StorageName)
    .filter(Boolean)
  const all = storageRows.value
    .map(r => r.StorageName)
    .filter(Boolean)
  return [...new Set([...bySku, ...all])].sort()
}

function resolveInitialStorageForSku(sku) {
  const options = getStorageOptionsForSku(sku)
  return options[0] || ''
}

function updateRowStorage(row, storageName) {
  row.storageName = storageName || ''
  row.currentQty = stockMovements.getCurrentQty(storageRows.value, row.storageName, row.sku)
}

function onAddSku(selected) {
  if (!selected) return
  const sku = typeof selected === 'object' ? selected.code : selected
  const initialStorageName = resolveInitialStorageForSku(sku)

  if (gridRows.value.some(r => r.sku === sku && r.storageName === initialStorageName)) {
    skuToAdd.value = null
    return
  }

  const skuMeta = allSkus.value.find(s => s.code === sku)
  gridRows.value.push({
    id: uid(),
    sku,
    storageName: initialStorageName,
    productName: skuMeta?.productName || '',
    currentQty: stockMovements.getCurrentQty(storageRows.value, initialStorageName, sku),
    qtyChange: 0
  })
  skuToAdd.value = null
}

function loadAllInWarehouse() {
  storageRows.value.forEach(r => {
    const storageName = (r.StorageName || '').toString().trim()
    if (!storageName) return
    if (gridRows.value.some(g => g.sku === r.SKU && g.storageName === storageName)) return

    const skuMeta = allSkus.value.find(s => s.code === r.SKU)
    gridRows.value.push({
      id: uid(),
      sku: r.SKU,
      storageName,
      productName: skuMeta?.productName || '',
      currentQty: Number(r.Quantity || 0),
      qtyChange: 0
    })
  })
}

function removeRow(id) {
  gridRows.value = gridRows.value.filter(r => r.id !== id)
}

async function onSubmit() {
  const missingStorageRows = nonZeroRows.value.filter(r => !r.storageName)
  if (missingStorageRows.length) {
    $q.notify({
      type: 'warning',
      message: 'Storage Location is required for each changed row.',
      caption: `Missing on ${missingStorageRows.length} row${missingStorageRows.length !== 1 ? 's' : ''}.`
    })
    return
  }

  const rows = nonZeroRows.value.map(r => ({
    sku: r.sku,
    storageName: r.storageName,
    qtyChange: r.qtyChange
  }))

  const result = await stockMovements.submitBatch(props.context, rows)
  if (result.succeeded > 0) {
    gridRows.value = []
    emit('submitted')
  }
}
</script>

<style scoped>
.stock-table {
  border-collapse: collapse;
}
.stock-table th,
.stock-table td {
  padding: 4px 8px;
  border-bottom: 1px solid #e0e0e0;
  vertical-align: middle;
}
.stock-table th {
  font-weight: 600;
  font-size: 0.75rem;
  color: #555;
  background: #fafafa;
}
</style>
