<template>
  <div class="q-gutter-y-md">
    <!-- Sold Items -->
    <div class="q-mb-sm text-subtitle2 text-weight-medium q-mt-lg">Sold Items</div>
    <q-list bordered separator class="rounded-borders">
      <q-item v-if="!soldRows.length">
        <q-item-section>
          <q-item-label class="text-grey-7">No sold quantity counted.</q-item-label>
        </q-item-section>
      </q-item>
      <q-item v-for="row in soldRows" :key="row.SKU">
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ row.ProductName }}</q-item-label>
          <q-item-label caption>{{ displayName(row) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-chip dense square color="positive" text-color="white">
            {{ row.SoldQty }}
          </q-chip>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- Return Items Section -->
    <div>
      <div class="row items-center q-mb-sm q-mt-lg">
        <span class="text-subtitle2 text-weight-medium text-negative row items-center">
          <q-icon name="assignment_return" class="q-mr-xs" />
          Return Items
        </span>
      </div>
      <div v-if="!returnRows.length" class="text-caption text-grey-7 q-mb-sm">
        No return items counted or manually added.
      </div>
      <q-list v-else bordered separator class="rounded-borders">
        <q-item v-for="row in returnRows" :key="row.SKU" class="q-py-sm">
          <q-item-section>
            <q-item-label class="text-weight-medium text-negative">{{ row.ProductName }}</q-item-label>
            <q-item-label caption>{{ displayName(row) }}</q-item-label>
            <div class="row q-gutter-xs q-mt-xs">
              <q-badge color="negative" dense class="text-weight-bold">Qty: {{ row.Qty }}</q-badge>
              <q-badge color="grey-7" dense>{{ returnMetadata[row.SKU]?.Reason || 'DAMAGE' }}</q-badge>
              <q-badge v-if="returnMetadata[row.SKU]?.InvoiceAdjustmentRequired" color="blue" dense>Invoice Adjust</q-badge>
              <q-badge v-if="returnMetadata[row.SKU]?.WarehouseActionRequired" color="purple" dense>WH: {{ returnMetadata[row.SKU]?.WarehouseCode || 'Default' }}</q-badge>
            </div>
            <q-item-label caption v-if="returnMetadata[row.SKU]?.ReasonComment" class="text-italic q-mt-xs text-grey-8">
              "{{ returnMetadata[row.SKU]?.ReasonComment }}"
            </q-item-label>
          </q-item-section>
          <q-item-section side class="self-center">
            <q-btn flat round dense color="primary" icon="edit_note" size="md" @click="openEditReturnDialog(row)">
              <q-tooltip>Configure return reasons & routing</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Restock Items -->
    <div>
      <div class="row items-center q-mb-sm">
        <span class="text-subtitle2 text-weight-medium">Restock Items</span>
        <q-space />
        <q-btn size="sm" color="primary" icon="add" label="Add" @click="openAddDialog" />
      </div>
      <div v-if="!restockRows.length" class="text-caption text-grey-7 q-mb-sm">
        No restock items. Add items or they will be auto-populated from sold quantities.
      </div>
      <q-list v-else bordered separator>
        <q-item v-for="(row, index) in restockRows" :key="`${row.SKU}-${index}`">
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ getRestockLabel(row) }}</q-item-label>
            <q-item-label caption>{{ getRestockCaption(row) }}</q-item-label>
          </q-item-section>
          <q-item-section class="col-shrink">
            <q-input outlined dense type="number" label="Qty" :model-value="row.Quantity" @update:model-value="$emit('update-restock', index, { Quantity: Number($event || 0) })" style="width: 60px;" />
          </q-item-section>
          <q-item-section side>
            <q-btn flat round dense color="negative" icon="delete" size="sm" @click="$emit('remove-restock', index)" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Submit Options -->
    <div class="text-subtitle2 text-weight-medium q-mt-lg">Submit Options</div>
    <q-list bordered separator class="rounded-borders q-mb-md">
      <q-item v-for="option in checklistRows" :key="option.key">
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ option.label }}</q-item-label>
          <q-item-label caption>{{ option.caption }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            :model-value="checklist[option.key]"
            :disable="option.disable"
            @update:model-value="$emit('update-checklist', { [option.key]: $event })"
          />
        </q-item-section>
      </q-item>
    </q-list>

    <!-- Discount Options (Conditional on generateInvoice) -->
    <q-card v-if="checklist.generateInvoice" flat bordered class="q-pa-md q-mb-md bg-grey-1 rounded-borders">
      <div class="text-subtitle2 q-mb-sm text-weight-bold text-primary">Invoice Discount</div>
      <div class="row q-col-gutter-sm items-center">
        <div class="col-6">
          <q-select
            :model-value="checklist.discountType || 'FLAT'"
            :options="[
              { label: 'Flat Amount', value: 'FLAT' },
              { label: 'Percentage (%)', value: 'PERCENT' }
            ]"
            emit-value
            map-options
            outlined
            dense
            options-dense
            class="bg-white"
            label="Discount Type"
            @update:model-value="$emit('update-checklist', { discountType: $event })"
          />
        </div>
        <div class="col-6">
          <q-input
            :model-value="checklist.discountValue"
            type="number"
            outlined
            dense
            label="Discount Value"
            class="bg-white"
            :min="0"
            @update:model-value="$emit('update-checklist', { discountValue: Number($event || 0) })"
          />
        </div>
      </div>
    </q-card>

    <!-- Restock Options Panel (Conditional on placeRestock toggle) -->
    <q-card v-if="checklist.placeRestock && canDirectRestock" flat bordered class="q-pa-md q-mb-md bg-grey-1 rounded-borders">
      <div class="text-subtitle2 q-mb-sm text-weight-bold text-primary">Restock Options</div>
      
      <div class="column q-gutter-y-sm">
        <div>
          <div class="text-caption text-grey-7 q-mb-xs">Submission Mode</div>
          <q-select
            :model-value="checklist.restockSubmissionMode || 'PENDING_APPROVAL'"
            :options="restockModeOptions"
            emit-value
            map-options
            outlined
            dense
            options-dense
            class="bg-white"
            @update:model-value="$emit('update-checklist', { restockSubmissionMode: $event })"
          >
            <template #prepend>
              <q-icon :name="restockModeIcon" :color="restockModeColor" />
            </template>
          </q-select>
        </div>

        <!-- Target Warehouse (only if APPROVED) -->
        <div v-if="checklist.restockSubmissionMode === 'APPROVED'">
          <div class="text-caption text-grey-7 q-mb-xs">Source Central Warehouse *</div>
          <q-select
            :model-value="checklist.restockWarehouseCode"
            :options="warehouseOptions"
            emit-value
            map-options
            outlined
            dense
            options-dense
            class="bg-white"
            placeholder="Select source warehouse..."
            :rules="[val => !!val || 'Warehouse is required for instant restock']"
            @update:model-value="$emit('update-checklist', { restockWarehouseCode: $event })"
          />
          <div class="row items-center q-pa-xs text-green-9 text-caption text-weight-medium">
            <q-icon name="info" size="xs" class="q-mr-xs" />
            <span>Warehouse stock will be deducted instantly.</span>
          </div>
        </div>
      </div>
    </q-card>

    <!-- Add Restock Dialog -->
    <q-dialog v-model="addDialogOpen" persistent>
      <q-card style="min-width: 320px">
        <q-card-section class="row items-center">
          <span class="text-h6">Add Restock Item</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="newItem.sku"
            :options="skuOptions"
            emit-value
            map-options
            outlined
            label="SKU"
            use-input
            hide-selected
            fill-input
            input-debounce="0"
            @filter="filterSkus"
          >
            <template #no-option>
              <q-item><q-item-section class="text-grey">No matching SKU</q-item-section></q-item>
            </template>
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.productName || scope.opt.label }}</q-item-label>
                  <q-item-label v-if="scope.opt.variant" caption>{{ scope.opt.variant }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-input
            v-model.number="newItem.qty"
            outlined
            type="number"
            label="Quantity"
            :min="0"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn unelevated label="Add" color="primary" :disable="!newItem.sku" @click="confirmAdd" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Configure Return Details Dialog -->
    <q-dialog v-model="editReturnOpen" persistent>
      <q-card style="min-width: 320px; border-radius: 12px;">
        <q-card-section class="row items-center q-pb-none">
          <span class="text-h6 text-weight-bold text-negative">Configure Return Details</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section class="q-pa-md q-gutter-y-md" v-if="activeReturnRow">
          <div class="text-subtitle2 text-weight-bold text-grey-8">{{ activeReturnRow.ProductName }}</div>

          <q-select
            v-model="editReturnForm.Reason"
            :options="reasonOptions"
            emit-value
            map-options
            outlined
            dense
            label="Return Reason Category *"
          />

          <q-input
            v-model="editReturnForm.ReasonComment"
            outlined
            dense
            type="textarea"
            rows="2"
            label="Details / Remarks"
            placeholder="Enter batch code, condition, details..."
          />

          <!-- Operational Flags -->
          <q-card flat bordered class="q-pa-sm bg-blue-5 bg-opacity-5" style="border: 1px solid rgba(33, 150, 243, 0.15);">
            <q-toggle
              v-model="editReturnForm.InvoiceAdjustmentRequired"
              label="Invoice Adjustment Required?"
              dense
              class="text-weight-bold text-primary"
            />
            <div class="text-caption text-grey-7 q-pl-sm q-mt-xs">
              Credits this return value on the consumption invoice.
            </div>
          </q-card>

          <q-card flat bordered class="q-pa-sm bg-purple-5 bg-opacity-5" style="border: 1px solid rgba(156, 39, 176, 0.15);">
            <q-toggle
              v-model="editReturnForm.WarehouseActionRequired"
              label="Is Stock Leaving Outlet (To Warehouse)?"
              dense
              class="text-weight-bold text-purple"
            />
            <div class="text-caption text-grey-7 q-pl-sm q-mt-xs">
              Select YES if physical stock goes back to central warehouse.
            </div>
          </q-card>

          <!-- Target Warehouse Selection -->
          <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
            <q-select
              v-if="editReturnForm.WarehouseActionRequired"
              v-model="editReturnForm.WarehouseCode"
              :options="warehouseOptions"
              emit-value
              map-options
              outlined
              dense
              label="Target Central Warehouse *"
            />
          </transition>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md bg-grey-1">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn unelevated label="Save details" color="primary" @click="saveReturnDetails" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'OutletConsumptionSummaryStep' })
const props = defineProps({
  soldRows: { type: Array, default: () => [] },
  restockRows: { type: Array, default: () => [] },
  skuOptions: { type: Array, default: () => [] },
  checklist: { type: Object, required: true },
  hasVisit: { type: Boolean, default: false },
  returnRows: { type: Array, default: () => [] },
  returnMetadata: { type: Object, default: () => ({}) },
  warehouseOptions: { type: Array, default: () => [] },
  canDirectRestock: { type: Boolean, default: false }
})
const emit = defineEmits(['update-restock', 'add-restock', 'remove-restock', 'update-checklist', 'update-return-metadata'])

const reasonOptions = [
  { label: 'Damage ⚠️', value: 'DAMAGE' },
  { label: 'Expired 📅', value: 'EXPIRED' },
  { label: 'Slow Moving 🐢', value: 'SLOW_MOVING' },
  { label: 'Recall 🚫', value: 'RECALL' },
  { label: 'Overstock 📦', value: 'OVERSTOCK' },
  { label: 'Specification Mismatch 🔄', value: 'SPECIFICATION_MISMATCH' },
  { label: 'Other ❓', value: 'OTHER' }
]

function displayName(row) {
  if (row.SkuLabel) {
    const parts = row.SkuLabel.split(' / ')
    if (parts.length > 1) {
      return parts.slice(1).join(' / ')
    }
    return row.SkuLabel
  }
  return row.SKU
}

const checklistRows = computed(() => {
  const rows = [
    { key: 'completeVisit', label: 'Complete selected visit', caption: props.hasVisit ? 'Marks the selected planned visit completed.' : 'No selected visit.', disable: !props.hasVisit },
    { key: 'scheduleNextVisit', label: 'Schedule next visit', caption: 'Creates the next planned visit from the outlet visit frequency.', disable: false },
    { key: 'generateInvoice', label: 'Generate invoice', caption: 'Creates an invoice based on price rules.', disable: false },
    { key: 'applyReturnsToInvoice', label: 'Apply return deductions', caption: props.returnRows.length ? 'Credits all unadjusted returns (and new returns) against the invoice.' : 'No unadjusted returns found.', disable: !props.returnRows.length && !props.checklist.generateInvoice },
    { key: 'placeRestock', label: 'Place restock request', caption: 'Creates a restock draft from restock rows.', disable: !props.restockRows.length }
  ]
  if (!props.canDirectRestock) {
    rows.push({ key: 'submitRestock', label: 'Submit restock immediately', caption: 'Moves created restock to pending approval.', disable: !props.checklist.placeRestock })
  }
  return rows
})

const restockModeOptions = computed(() => {
  const options = [
    { label: 'Draft (Save to edit later)', value: 'DRAFT' },
    { label: 'Standard Submit (Requires approval)', value: 'PENDING_APPROVAL' }
  ]
  if (props.canDirectRestock) {
    options.push({ label: 'Instant Delivery (Auto-approved restock)', value: 'APPROVED' })
  }
  return options
})

const restockModeIcon = computed(() => {
  const mode = props.checklist.restockSubmissionMode || 'PENDING_APPROVAL'
  if (mode === 'APPROVED') return 'check_circle'
  if (mode === 'PENDING_APPROVAL') return 'hourglass_top'
  return 'drafts'
})

const restockModeColor = computed(() => {
  const mode = props.checklist.restockSubmissionMode || 'PENDING_APPROVAL'
  if (mode === 'APPROVED') return 'positive'
  if (mode === 'PENDING_APPROVAL') return 'orange'
  return 'grey-6'
})

const addDialogOpen = ref(false)
const newItem = ref({ sku: '', qty: 1 })
const skuFilterRef = ref([])

const editReturnOpen = ref(false)
const activeReturnRow = ref(null)
const editReturnForm = ref({
  Reason: 'DAMAGE',
  ReasonComment: '',
  InvoiceAdjustmentRequired: true,
  WarehouseActionRequired: false,
  WarehouseCode: ''
})

watch(() => props.skuOptions, (opts) => { skuFilterRef.value = opts }, { immediate: true })

function filterSkus(val, update) {
  if (val === '') {
    update(() => { skuFilterRef.value = props.skuOptions })
    return
  }
  update(() => {
    const needle = val.toLowerCase()
    skuFilterRef.value = props.skuOptions.filter(v =>
      v.label.toLowerCase().indexOf(needle) > -1 ||
      v.value.toLowerCase().indexOf(needle) > -1
    )
  })
}

function getRestockLabel(row) {
  const opt = props.skuOptions.find(o => o.value === row.SKU)
  return opt ? opt.productName : row.ProductName || row.SKU
}

function getRestockCaption(row) {
  const opt = props.skuOptions.find(o => o.value === row.SKU)
  return opt ? opt.variant : row.SKU
}

function openAddDialog() {
  newItem.value = { sku: '', qty: 1 }
  skuFilterRef.value = props.skuOptions
  addDialogOpen.value = true
}

function confirmAdd() {
  emit('add-restock', newItem.value.sku, newItem.value.qty)
  addDialogOpen.value = false
}

function openEditReturnDialog(row) {
  activeReturnRow.value = row
  const meta = props.returnMetadata[row.SKU] || {}
  editReturnForm.value = {
    Reason: meta.Reason || 'DAMAGE',
    ReasonComment: meta.ReasonComment || '',
    InvoiceAdjustmentRequired: meta.InvoiceAdjustmentRequired !== false,
    WarehouseActionRequired: !!meta.WarehouseActionRequired,
    WarehouseCode: meta.WarehouseCode || props.warehouseOptions[0]?.value || ''
  }
  editReturnOpen.value = true
}

function saveReturnDetails() {
  if (!activeReturnRow.value) return
  emit('update-return-metadata', activeReturnRow.value.SKU, editReturnForm.value)
  editReturnOpen.value = false
  activeReturnRow.value = null
}
</script>

<style lang="scss" scoped>
.bg-opacity-5 {
  background-color: rgba(3, 169, 244, 0.03) !important;
}
</style>
