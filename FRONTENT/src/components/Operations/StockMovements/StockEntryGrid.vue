<template>
  <div class="stock-entry-grid">
    <div class="row q-mb-md">
      <q-input
        v-model="filter"
        placeholder="Filter by SKU, Product Name, or Storage"
        outlined
        dense
        clearable
        class="col-12"
      >
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else class="grid-rows q-gutter-y-sm">
      <div v-if="filteredRows.length === 0 && !filter" class="text-center q-pa-md text-grey-8">
        No stock found for this warehouse. Add new stock below.
      </div>

      <!-- Existing Rows -->
      <q-card
        v-for="(row, index) in filteredRows"
        :key="row.id"
        class="stock-row"
        :class="{ 'bg-yellow-1': row.currentQty !== row.originalQty, 'bg-grey-2': row.removed }"
      >
        <q-card-section class="q-pa-sm row items-center justify-between no-wrap">
          <div class="col-8">
            <div class="text-subtitle2" :class="{ 'text-strike text-grey-6': row.removed }">
              {{ row.skuLabel }}
            </div>
            <div class="text-caption text-grey-8" :class="{ 'text-strike text-grey-6': row.removed }">
              {{ row.StorageName }}
            </div>
          </div>
          <div class="col-4 row items-center justify-end no-wrap q-gutter-x-sm">
            <div style="width: 80px;">
              <q-input
                v-model.number="row.currentQty"
                type="number"
                dense
                outlined
                :disable="row.removed"
                input-class="text-right"
              />
            </div>
            <q-btn
              v-if="!row.removed"
              flat
              round
              dense
              icon="delete_outline"
              color="negative"
              @click="markRemoved(row)"
            />
            <q-btn
              v-else
              flat
              round
              dense
              icon="undo"
              color="primary"
              @click="undoRemoved(row)"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- New Rows -->
      <q-card
        v-for="(newRow, index) in newRows"
        :key="newRow.id"
        class="stock-row new-row q-mt-md"
      >
        <q-card-section class="q-pa-sm">
          <div class="row q-col-gutter-sm items-center">
            <div class="col-12">
              <q-select
                v-model="newRow.selectedSku"
                :options="skuOptions"
                option-value="SKU"
                option-label="label"
                label="Select SKU"
                outlined
                dense
                use-input
                @filter="filterSkus"
                @update:model-value="onNewRowChange(newRow)"
              >
                <template v-slot:no-option>
                  <q-item>
                    <q-item-section class="text-grey">
                      No SKUs found
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
            <div class="col-7">
              <q-select
                v-model="newRow.StorageName"
                :options="storageOptions"
                label="Storage"
                outlined
                dense
                use-input
                new-value-mode="add-unique"
                @filter="filterStorages"
                @update:model-value="onNewRowChange(newRow)"
              />
            </div>
            <div class="col-5">
              <q-input
                v-model.number="newRow.qty"
                type="number"
                label="Qty"
                dense
                outlined
                input-class="text-right"
                @update:model-value="onNewRowChange(newRow)"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Sticky Bottom Bar -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]" v-if="dirtyCount > 0">
      <q-btn
        fab
        icon="save"
        color="primary"
        :label="`Save (${dirtyCount})`"
        @click="saveChanges"
        :loading="saving"
      />
    </q-page-sticky>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStockMovements } from 'src/composables/operations/stock/useStockMovements'

const props = defineProps({
  warehouseCode: {
    type: String,
    required: true
  }
})

const { loadStoragesForWarehouse, loadSkusWithProducts, submitBatch } = useStockMovements()

const loading = ref(true)
const saving = ref(false)
const filter = ref('')
const existingRows = ref([])
const newRows = ref([])
const allSkus = ref([])
const skuOptions = ref([])
const fetchedStorageNames = ref([])
const storageOptions = ref([])

const allStorageNames = computed(() => {
  const merged = new Set(fetchedStorageNames.value)
  newRows.value.forEach((r) => {
    const name = typeof r.StorageName === 'string' ? r.StorageName.trim() : ''
    if (name) merged.add(name)
  })
  return Array.from(merged)
})

onMounted(async () => {
  await fetchData()
})

async function fetchData(forceSync = false) {
  loading.value = true
  existingRows.value = []
  newRows.value = []

  const [storages, skus] = await Promise.all([
    loadStoragesForWarehouse(props.warehouseCode, forceSync),
    loadSkusWithProducts()
  ])

  allSkus.value = skus
  skuOptions.value = skus

  // Extract unique storage names
  const storageSet = new Set(storages.map(s => s.StorageName).filter(Boolean))
  fetchedStorageNames.value = Array.from(storageSet)
  storageOptions.value = allStorageNames.value

  // Map to reactive rows
  existingRows.value = storages.filter(s => Number(s.Quantity || 0) > 0).map((s, idx) => {
    const skuInfo = skus.find(sku => sku.SKU === s.SKU)
    return {
      id: `ext_${idx}`,
      SKU: s.SKU,
      skuLabel: skuInfo ? skuInfo.label : s.SKU,
      StorageName: s.StorageName,
      originalQty: Number(s.Quantity || 0),
      currentQty: Number(s.Quantity || 0),
      removed: false,
      productName: skuInfo ? skuInfo.ProductName : ''
    }
  })

  // Initialize one empty new row
  addNewRow()

  loading.value = false
}

function addNewRow() {
  newRows.value.push({
    id: `new_${Date.now()}_${Math.random()}`,
    selectedSku: null,
    StorageName: null,
    qty: null,
    isDirty: false
  })
}

function onNewRowChange(row) {
  row.isDirty = true
  // If this is the last row and it has some data, add a new empty row
  const lastRow = newRows.value[newRows.value.length - 1]
  if (row.id === lastRow.id && (row.selectedSku || row.StorageName || row.qty !== null)) {
    addNewRow()
  }
}

function filterSkus(val, update) {
  if (val === '') {
    update(() => {
      skuOptions.value = allSkus.value
    })
    return
  }
  update(() => {
    const needle = val.toLowerCase()
    skuOptions.value = allSkus.value.filter(
      v => v.label.toLowerCase().indexOf(needle) > -1
    )
  })
}

function filterStorages(val, update) {
  const source = allStorageNames.value
  if (val === '' || val == null) {
    update(() => {
      storageOptions.value = source
    })
    return
  }
  update(() => {
    const needle = String(val).toLowerCase()
    storageOptions.value = source.filter(
      (v) => v && v.toLowerCase().indexOf(needle) > -1
    )
  })
}

const filteredRows = computed(() => {
  let list = existingRows.value
  if (filter.value) {
    const needle = filter.value.toLowerCase()
    list = list.filter(row =>
      row.skuLabel.toLowerCase().includes(needle) ||
      row.StorageName.toLowerCase().includes(needle) ||
      (row.productName && row.productName.toLowerCase().includes(needle))
    )
  }
  return list
})

const dirtyExistingRows = computed(() => {
  return existingRows.value.filter(row => row.currentQty !== row.originalQty)
})

const validNewRows = computed(() => {
  return newRows.value.filter(row =>
    row.selectedSku &&
    row.StorageName &&
    row.qty !== null &&
    row.qty !== '' &&
    Number(row.qty) !== 0
  )
})

const dirtyCount = computed(() => {
  return dirtyExistingRows.value.length + validNewRows.value.length
})

function markRemoved(row) {
  row.currentQty = 0
  row.removed = true
}

function undoRemoved(row) {
  row.currentQty = row.originalQty
  row.removed = false
}

async function saveChanges() {
  if (dirtyCount.value === 0) return

  saving.value = true

  const movements = []

  dirtyExistingRows.value.forEach(row => {
    movements.push({
      sku: row.SKU,
      storageName: row.StorageName,
      qtyChange: row.currentQty - row.originalQty
    })
  })

  validNewRows.value.forEach(row => {
    movements.push({
      sku: row.selectedSku.SKU,
      storageName: row.StorageName,
      qtyChange: Number(row.qty)
    })
  })

  const { succeeded } = await submitBatch(
    { warehouseCode: props.warehouseCode, referenceType: 'DirectEntry' },
    movements
  )

  if (succeeded > 0) {
    // IDB is fresh: WarehouseStorages was fetched in the same batch as the create.
    // GasApiService auto-ingested the response, so reading from cache here is a no-op network-wise.
    await fetchData(false)
  }

  saving.value = false
}
</script>

<style scoped>
.stock-row {
  border-left: 4px solid transparent;
  transition: all 0.2s ease;
}
.bg-yellow-1 {
  border-left-color: #f2c037;
}
.new-row {
  border: 1px dashed #ccc;
}
</style>
