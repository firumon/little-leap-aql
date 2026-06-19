<template>
  <q-page padding class="q-pb-xl">
    <GenericHeaderPanel
      back
      :label="recordCode"
      caption="Complete Transfer"
      class="q-mb-md"
      @click="goBack"
    />

    <q-linear-progress v-if="loading" color="primary" indeterminate rounded class="q-mb-md" />

    <!-- Transfer route banner -->
    <q-card flat bordered class="q-mb-md">
      <q-item dense class="q-py-sm q-px-md">
        <q-item-section side>
          <q-icon name="warehouse" color="grey-6" size="18px" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption class="text-grey-6">Source Warehouse</q-item-label>
          <q-item-label class="text-weight-medium text-grey-9">{{ warehouseName(record?.SourceWarehouseCode) }}</q-item-label>
        </q-item-section>
        <q-item-section side class="q-px-xs">
          <q-icon name="arrow_forward" color="grey-5" size="18px" />
        </q-item-section>
        <q-item-section side class="q-mr-md">
          <q-icon name="location_on" color="primary" size="18px" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption class="text-grey-6">Destination</q-item-label>
          <q-item-label class="text-weight-medium" :class="effectiveDestWH ? 'text-primary' : 'text-grey-5'">
            {{ effectiveDestWH ? warehouseName(effectiveDestWH) : 'Not selected' }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-card>

    <template v-if="!hasDestination">
      <q-card flat bordered class="q-mb-md">
        <q-item class="bg-grey-1 q-py-sm q-px-md">
          <q-item-section side>
            <q-icon name="location_on" color="primary" size="20px" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold text-grey-8">Select Destination Warehouse</q-item-label>
          </q-item-section>
        </q-item>
        <q-separator />
        <q-card-section>
          <q-select v-model="selectedWarehouse" :options="warehouseOptions" label="Destination Warehouse *" outlined dense emit-value map-options :rules="[v => !!v || 'Required']" />
        </q-card-section>
      </q-card>
    </template>

    <q-card flat bordered class="q-mb-md">
      <q-item class="bg-grey-1 q-py-sm q-px-md">
        <q-item-section side>
          <q-icon name="storage" color="primary" size="20px" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-bold text-grey-8">Apply Storage to All Items</q-item-label>
        </q-item-section>
      </q-item>
      <q-separator />
      <q-card-section>
        <div class="row items-center q-gutter-sm">
          <q-select v-model="bulkStorage" :options="storageOptionsWithNew" label="Select Storage" outlined dense map-options emit-value class="col" @update:model-value="onBulkStorageChange">
            <template v-slot:option="{ itemProps, opt }">
              <q-item v-bind="itemProps">
                <q-item-section side v-if="opt.value === '__new__'">
                  <q-icon name="add" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label :class="opt.value === '__new__' ? 'text-primary text-weight-bold' : ''">{{ opt.label }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-btn color="primary" label="Apply to All" :disable="!bulkStorage || bulkStorage === '__new__'" unelevated @click="applyBulkStorage" />
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="Item Storage Assignment" />

    <q-card v-for="(item, itemIdx) in items" :key="item.SKUCode" flat bordered class="q-mb-xs">
      <q-list class="q-py-sm">
        <q-item>
          <q-item-section side>
            <q-icon name="check_circle" size="sm" color="positive" v-if="allAssigned(item)" />
            <q-icon name="error" size="sm" color="negative" v-else />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold text-grey-8">{{ skuName(item.SKUCode) }} - {{ item.SKUCode }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-chip :label="assignedQty(item) + ' / ' + item.originalQty" :color="allAssigned(item) ? 'positive' : 'negative'" text-color="white"  />
          </q-item-section>
        </q-item>
      </q-list>
      <q-separator />
      <q-list dense padding>
        <q-item v-for="(split, splitIdx) in item.splits" :key="splitIdx">
          <q-item-section side>
            <q-input v-model.number="split.qty" type="number" label="Qty" outlined dense :min="0" :max="item.originalQty" />
          </q-item-section>
          <q-item-section>
            <q-select v-model="split.storage" :options="storageOptionsWithNew" label="Storage" outlined dense map-options emit-value class="col" @update:model-value="(val) => onItemStorageChange(val, itemIdx, splitIdx)">
              <template v-slot:option="{ itemProps, opt }">
                <q-item v-bind="itemProps">
                  <q-item-section side v-if="opt.value === '__new__'">
                    <q-icon name="add" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label :class="opt.value === '__new__' ? 'text-primary text-weight-bold' : ''">{{ opt.label }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-item-section>
          <q-item-section side v-if="(item.splits.length > 1) || (splitIdx === item.splits.length - 1 && splitQtyRemaining(item) > 0)">
            <div>
              <q-btn v-if="item.splits.length > 1" flat round dense icon="remove_circle_outline" color="negative" @click="removeSplit(itemIdx, splitIdx)" />
              <q-btn v-if="splitIdx === item.splits.length - 1 && splitQtyRemaining(item) > 0" flat round dense icon="add_circle_outline" color="primary" @click="addSplit(itemIdx)" />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <q-card v-if="!items.length" flat bordered class="q-mb-md">
      <q-card-section class="text-center q-pa-lg">
        <q-icon name="inventory_2" size="48px" color="grey-4" class="q-mb-sm" />
        <div class="text-subtitle1 text-weight-bold text-grey-6">No pending items</div>
        <div class="text-caption text-grey-5">All items have already been fulfilled.</div>
      </q-card-section>
    </q-card>

    <div class="q-mt-lg" v-if="items.length">
      <q-btn unelevated glossy color="primary" size="lg" label="Complete Transfer" icon="check_circle" class="full-width" :loading="saving" :disable="!canComplete" @click="confirmComplete" />
    </div>

    <q-dialog v-model="newStorageDialog.open" persistent>
      <q-card style="min-width: 340px; max-width: 90vw;">
        <q-card-section class="bg-primary text-white row items-center q-py-sm q-px-md">
          <q-icon name="add" class="q-mr-sm" color="white" />
          <span class="text-subtitle1 text-weight-bold text-white">New Storage</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup color="white" />
        </q-card-section>
        <q-card-section class="q-pt-md q-px-md">
          <q-input v-model="newStorageDialog.name" label="Storage Name *" outlined dense autofocus :rules="[v => !!v || 'Name is required']" @keyup.enter="addNewStorage" />
        </q-card-section>
        <q-card-actions align="right" class="q-pb-md q-pr-md">
          <q-btn flat label="Cancel" color="grey-7" v-close-popup />
          <q-btn unelevated color="primary" label="Add & Select" :disable="!newStorageDialog.name" @click="addNewStorage" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useWarehouseTransfers } from '../../../composables/operations/warehouseTransfers/useWarehouseTransfers.js'
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from "components/shared/AqlList.vue";

defineOptions({ name: 'WarehouseTransfersCompletePage' })

const $q = useQuasar()
const route = useRoute()
const nav = useResourceNav()
const flow = useWarehouseTransfers()
const { loading, saving, transfers, transferItems, warehouses, warehouseOptions, skuName, reload, getStorageOptionsForWarehouse, executeAction, completeItem, completeWarehouseTransfer } = flow

const recordCode = computed(() => route.params.code)
const record = computed(() => transfers.items.value.find(t => t.Code === recordCode.value) || null)
const hasDestination = computed(() => !!record.value?.DestinationWarehouseCode)
const selectedWarehouse = ref('')
const effectiveDestWH = computed(() => record.value?.DestinationWarehouseCode || selectedWarehouse.value || '')

function warehouseName(code) {
  if (!code) return '—'
  const wh = warehouses.items.value.find(w => w.Code === code)
  return wh ? `${wh.Name || wh.Code} (${wh.Code})` : code
}

const rawItems = computed(() =>
  transferItems.items.value.filter(
    item => item.WarehouseTransferCode === recordCode.value && (item.Status || 'Active') === 'Active' && item.Progress === 'PENDING'
  )
)

const customStorages = ref([])

const storageOptions = computed(() => {
  const whCode = selectedWarehouse.value || record.value?.DestinationWarehouseCode
  const base = whCode ? getStorageOptionsForWarehouse(whCode) : []
  const existing = new Set(base.map(s => s.value))
  const extras = customStorages.value.filter(s => !existing.has(s)).map(s => ({ label: s, value: s }))
  return [...base, ...extras]
})

const storageOptionsWithNew = computed(() => [
  ...storageOptions.value,
  { label: 'New Storage...', value: '__new__' }
])

const items = ref([])
const bulkStorage = ref(null)

function buildItems() {
  items.value = rawItems.value.map(item => ({
    Code: item.Code,
    SKUCode: item.SKUCode,
    SourceStorageName: item.SourceStorageName || '_default',
    originalQty: Number(item.Quantity),
    splits: [{ qty: Number(item.Quantity), storage: '_default' }]
  }))
}

function assignedQty(item) {
  return item.splits.reduce((sum, s) => sum + (Number(s.qty) || 0), 0)
}

function allAssigned(item) {
  return assignedQty(item) === item.originalQty
}

function splitQtyRemaining(item) {
  return Math.max(0, item.originalQty - assignedQty(item))
}

function addSplit(itemIdx) {
  const remaining = splitQtyRemaining(items.value[itemIdx])
  if (remaining <= 0) return
  items.value[itemIdx].splits.push({ qty: remaining, storage: '_default' })
}

function removeSplit(itemIdx, splitIdx) {
  items.value[itemIdx].splits.splice(splitIdx, 1)
}

function onBulkStorageChange(val) {
  if (val === '__new__') {
    newStorageDialog.value = { open: true, name: '', targetType: 'bulk' }
    return
  }
  bulkStorage.value = val
}

function onItemStorageChange(val, itemIdx, splitIdx) {
  if (val === '__new__') {
    newStorageDialog.value = { open: true, name: '', targetType: 'item', targetItemIdx: itemIdx, targetSplitIdx: splitIdx }
    items.value[itemIdx].splits[splitIdx].storage = null
    return
  }
  items.value[itemIdx].splits[splitIdx].storage = val
}

const newStorageDialog = ref({ open: false, name: '', targetType: '', targetItemIdx: null, targetSplitIdx: null })

function addNewStorage() {
  const name = newStorageDialog.value.name.trim()
  if (!name) return
  customStorages.value.push(name)
  const { targetType, targetItemIdx, targetSplitIdx } = newStorageDialog.value
  if (targetType === 'bulk') {
    bulkStorage.value = name
  } else if (targetType === 'item') {
    items.value[targetItemIdx].splits[targetSplitIdx].storage = name
  }
  newStorageDialog.value = { open: false, name: '', targetType: '', targetItemIdx: null, targetSplitIdx: null }
}

function applyBulkStorage() {
  const storage = bulkStorage.value
  if (!storage) return
  for (const item of items.value) {
    for (const split of item.splits) {
      split.storage = storage
    }
  }
  $q.notify({ type: 'positive', message: `Applied storage "${storage}" to all items.`, position: 'top', timeout: 1500 })
}

const canComplete = computed(() => {
  if (!hasDestination.value && !selectedWarehouse.value) return false
  for (const item of items.value) {
    if (!allAssigned(item)) return false
    for (const split of item.splits) {
      if (!split.storage || (Number(split.qty) || 0) <= 0) return false
    }
  }
  return items.value.length > 0
})

function confirmComplete() {
  $q.dialog({
    title: 'Complete Transfer',
    message: 'This will assign all items to selected storages and complete the transfer.',
    cancel: true,
    persistent: true,
    ok: { color: 'primary', label: 'Complete' }
  }).onOk(async () => {
    const destWH = !hasDestination.value ? selectedWarehouse.value : ''
    const success = await completeWarehouseTransfer(recordCode.value, destWH, items.value)
    if (success) {
      nav.goTo('view')
    }
  })
}

function goBack() {
  nav.goTo('view')
}

onMounted(async () => {
  await reload()
  selectedWarehouse.value = record.value?.DestinationWarehouseCode || ''
  buildItems()
})
</script>
