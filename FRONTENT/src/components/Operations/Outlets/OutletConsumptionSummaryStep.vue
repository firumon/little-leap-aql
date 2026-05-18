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
          <q-item-label>{{ row.SkuLabel || displayName(row) }}</q-item-label>
          <q-item-label caption>{{ row.ProductName || '' }}</q-item-label>
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
  hasVisit: { type: Boolean, default: false }
})
const emit = defineEmits(['update-restock', 'add-restock', 'remove-restock', 'update-checklist'])

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

const checklistRows = computed(() => [
  { key: 'completeVisit', label: 'Complete selected visit', caption: props.hasVisit ? 'Marks the selected planned visit completed.' : 'No selected visit.', disable: !props.hasVisit },
  { key: 'scheduleNextVisit', label: 'Schedule next visit', caption: 'Creates the next planned visit from the outlet visit frequency.', disable: false },
  { key: 'generateInvoice', label: 'Generate invoice', caption: 'Creates a zero-value invoice until pricing is designed.', disable: false },
  { key: 'placeRestock', label: 'Place restock request', caption: 'Creates a restock draft from restock rows.', disable: !props.restockRows.length },
  { key: 'submitRestock', label: 'Submit restock immediately', caption: 'Moves created restock to pending approval.', disable: !props.checklist.placeRestock }
])

const addDialogOpen = ref(false)
const newItem = ref({ sku: '', qty: 1 })
const skuFilterRef = ref([])

watch(() => props.skuOptions, (opts) => { skuFilterRef.value = opts }, { immediate: true })

function filterSkus(val, update) {
  if (val === '') {
    update(() => { skuFilterRef.value = props.skuOptions })
    return
  }
  update(() => {
    const needle = val.toLowerCase()
    skuFilterRef.value = props.skuOptions.filter(v => v.label.toLowerCase().indexOf(needle) > -1)
  })
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
</script>
