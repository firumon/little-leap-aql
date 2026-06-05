<template>
  <div class="q-gutter-sm">
    <!-- Regular Stock Section -->
    <div class="text-subtitle2 text-weight-bold text-grey-8 q-mb-xs">Stock Count</div>
    <q-banner v-if="!regularRows.length" rounded class="bg-grey-2 text-grey-8">
      No regular outlet stock rows found for this outlet.
    </q-banner>

    <q-card v-for="row in regularRows" :key="row.SKU" flat bordered class="q-mb-sm">
      <q-card-section>
        <!-- Product Header: name left, system chip sticky right -->
        <div class="row items-start justify-between no-wrap q-mb-sm">
          <div class="col-auto ellipsis-2-lines">
            <div class="text-subtitle2 text-weight-medium">{{ row.ProductName }}</div>
            <div class="text-caption text-grey-7">{{ displayName(row) }}</div>
          </div>
          <q-chip dense square color="grey-3" text-color="dark" class="q-ml-sm">
            <q-icon name="inventory_2" size="xs" class="q-mr-xs" />
            System: {{ row.SystemQty }}
          </q-chip>
        </div>

        <!-- Controls: +/- with input -->
        <div class="row items-center justify-center q-gutter-md q-my-sm">
          <q-btn
            unelevated
            round
            color="primary"
            icon="remove"
            size="md"
            @click="$emit('decrement', getIndex(row))"
          />
          <q-input
            outlined
            type="number"
            dense
            input-class="text-center text-h6 text-weight-bold"
            style="width: 96px"
            :model-value="row.CurrentQty"
            @update:model-value="$emit('update-current', getIndex(row), $event)"
          />
          <q-btn
            unelevated
            round
            color="primary"
            icon="add"
            size="md"
            @click="$emit('increment', getIndex(row))"
          />
        </div>

        <!-- Info chips row (Sold/Restock OR Return) -->
        <div class="row items-center justify-center q-gutter-sm">
          <template v-if="row.CurrentQty <= row.SystemQty">
            <q-chip dense square color="positive" text-color="white">
              Sold: {{ row.SoldQty }}
            </q-chip>
            <q-chip dense square color="info" text-color="white">
              Restock: {{ row.SoldQty }}
            </q-chip>
          </template>
          <template v-else>
            <q-chip dense square color="warning" text-color="white">
              Return: {{ row.CurrentQty - row.SystemQty }}
            </q-chip>
          </template>
        </div>
      </q-card-section>
    </q-card>

    <!-- Returns Section Header -->
    <div class="row items-center justify-between q-mt-lg q-mb-sm">
      <div class="text-subtitle2 text-weight-bold text-grey-8">Additional Return Items</div>
      <q-btn size="sm" color="primary" icon="add" label="Add Return Item" @click="openAddDialog" />
    </div>

    <!-- Additional Return Rows -->
    <q-banner v-if="!manualReturnRows.length" rounded class="bg-grey-1 text-grey-6 q-mb-md text-center text-caption" style="border: 1px dashed rgba(0,0,0,0.08)">
      No additional return items logged.
    </q-banner>

    <q-card v-for="row in manualReturnRows" :key="row.SKU" flat bordered class="q-mb-sm" style="border-left: 4px solid var(--q-primary, #0284c7)">
      <q-card-section class="q-pa-sm">
        <div class="row items-start justify-between no-wrap q-mb-xs">
          <div class="col ellipsis-2-lines">
            <div class="text-subtitle2 text-weight-medium text-primary">{{ row.ProductName }}</div>
            <div class="text-caption text-grey-7">{{ displayName(row) }}</div>
          </div>
          <q-btn flat round dense color="negative" icon="delete" size="sm" @click="$emit('remove-manual-return', getIndex(row))" />
        </div>
        <div class="row items-center justify-center q-gutter-md q-my-sm">
          <q-btn unelevated round color="primary" icon="remove" size="md" @click="$emit('decrement', getIndex(row))" />
          <q-input
            outlined
            type="number"
            dense
            input-class="text-center text-h6 text-weight-bold"
            style="width: 96px"
            :model-value="row.CurrentQty"
            @update:model-value="$emit('update-current', getIndex(row), $event)"
          />
          <q-btn unelevated round color="primary" icon="add" size="md" @click="$emit('increment', getIndex(row))" />
        </div>
        <div class="row items-center justify-center q-gutter-sm">
          <q-chip dense square color="warning" text-color="white">
            Return: {{ row.CurrentQty }}
          </q-chip>
        </div>
      </q-card-section>
    </q-card>

    <!-- Add Return SKU Dialog -->
    <q-dialog v-model="addDialogOpen" persistent>
      <q-card style="min-width: 320px; border-radius: 12px;">
        <q-card-section class="row items-center q-pb-none">
          <span class="text-h6 text-weight-bold">Log Return Item</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section class="q-pa-md">
          <q-select
            v-model="selectedSku"
            :options="skuFilterRef"
            emit-value
            map-options
            outlined
            label="Search or Select SKU *"
            use-input
            hide-selected
            fill-input
            input-debounce="0"
            @filter="filterSkus"
          >
            <template #no-option>
              <q-item><q-item-section class="text-grey">No matching SKU found</q-item-section></q-item>
            </template>
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ scope.opt.productName || scope.opt.label }}</q-item-label>
                  <q-item-label v-if="scope.opt.variant" caption>{{ scope.opt.variant }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn unelevated label="Add" color="primary" :disable="!selectedSku" @click="confirmAdd" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'OutletConsumptionStockCountStep' })
const props = defineProps({
  rows: { type: Array, default: () => [] },
  skuOptions: { type: Array, default: () => [] }
})
const emit = defineEmits(['update-current', 'increment', 'decrement', 'add-manual-return', 'remove-manual-return'])

const addDialogOpen = ref(false)
const selectedSku = ref('')
const skuFilterRef = ref([])

watch(() => props.skuOptions, (opts) => { skuFilterRef.value = opts }, { immediate: true })

const regularRows = computed(() => props.rows.filter(r => !r.isManualReturn))
const manualReturnRows = computed(() => props.rows.filter(r => r.isManualReturn))

function getIndex(row) {
  return props.rows.findIndex(r => r.SKU === row.SKU)
}

function displayName(row) {
  if (row.SkuLabel) {
    const parts = row.SkuLabel.split(' / ')
    if (parts.length > 1) return parts.slice(1).join(' / ')
    return row.SkuLabel
  }
  return row.SKU
}

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

function openAddDialog() {
  selectedSku.value = ''
  skuFilterRef.value = props.skuOptions
  addDialogOpen.value = true
}

function confirmAdd() {
  if (!selectedSku.value) return
  emit('add-manual-return', selectedSku.value)
  addDialogOpen.value = false
}
</script>
