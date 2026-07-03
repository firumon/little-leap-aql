<template>
  <div>
    <div v-if="items.length === 0" class="text-center q-pa-lg text-grey-8">
      No accepted GRN items found.
    </div>

    <div v-else class="q-gutter-md">
      <q-card v-for="item in items" :key="item.Code" flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-start q-col-gutter-sm">
            <div class="col-12 col-sm">
              <div class="text-subtitle2">{{ item.SKU }}</div>
              <div class="text-caption text-grey-8">{{ item.ProductName }}</div>
            </div>
            <div class="col-12 col-sm-auto row q-col-gutter-sm">
              <div class="col">
                <q-chip dense square color="blue-1" text-color="blue-10">
                  GRN {{ item.Qty }}
                </q-chip>
              </div>
              <div class="col">
                <q-chip dense square :color="summaryColor(item.Code)" :text-color="summaryTextColor(item.Code)">
                  Remaining {{ summary[item.Code]?.remaining || 0 }}
                </q-chip>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pa-sm q-gutter-sm">
          <div
            v-for="row in allocationGroups[item.Code] || []"
            :key="row.id"
            class="row q-col-gutter-sm items-center"
          >
            <div class="col-12 col-sm-5">
              <q-select
                :model-value="row.storageName"
                :options="storageOptions"
                option-label="label"
                option-value="value"
                emit-value
                map-options
                use-input
                new-value-mode="add-unique"
                dense
                outlined
                label="Storage"
                @update:model-value="(value) => updateAllocation(row.id, { storageName: value })"
              />
            </div>
            <div class="col-7 col-sm-3">
              <q-input
                :model-value="row.qty"
                type="number"
                dense
                outlined
                min="0"
                label="Allocated"
                input-class="text-right"
                @update:model-value="(value) => updateAllocation(row.id, { qty: value })"
              />
            </div>
            <div class="col-5 col-sm-3 text-caption text-grey-8">
              Stock: {{ currentStockFor(row) }}
            </div>
            <div class="col-12 col-sm-1 text-right">
              <q-btn
                flat
                round
                dense
                icon="delete_outline"
                color="negative"
                :disable="(allocationGroups[item.Code] || []).length <= 1"
                @click="removeAllocation(row.id)"
              />
            </div>
          </div>

          <q-btn
            flat
            dense
            icon="add"
            color="primary"
            label="Split"
            @click="addAllocation(item.Code)"
          />
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  allocationGroups: {
    type: Object,
    default: () => ({})
  },
  summary: {
    type: Object,
    default: () => ({})
  },
  storageOptions: {
    type: Array,
    default: () => []
  },
  currentStockFor: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['update-allocation', 'add-allocation', 'remove-allocation'])

function updateAllocation(rowId, patch) {
  emit('update-allocation', rowId, patch)
}

function addAllocation(itemCode) {
  emit('add-allocation', itemCode)
}

function removeAllocation(rowId) {
  emit('remove-allocation', rowId)
}

function summaryColor(itemCode) {
  return Number(summaryValue(itemCode).remaining) === 0 ? 'green-1' : 'orange-1'
}

function summaryTextColor(itemCode) {
  return Number(summaryValue(itemCode).remaining) === 0 ? 'green-10' : 'orange-10'
}

function summaryValue(itemCode) {
  return props.summary[itemCode] || {}
}
</script>
