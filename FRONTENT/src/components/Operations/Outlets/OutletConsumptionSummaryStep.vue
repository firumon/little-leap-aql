<template>
  <div class="column q-gutter-md">
    <q-list bordered separator class="rounded-borders">
      <q-item-label header>Sold Items</q-item-label>
      <q-item v-if="!soldRows.length">
        <q-item-section><q-item-label>No sold quantity counted.</q-item-label></q-item-section>
      </q-item>
      <q-item v-for="row in soldRows" :key="row.SKU">
        <q-item-section>
          <q-item-label>{{ row.ProductName }}</q-item-label>
          <q-item-label caption>{{ row.SkuLabel || row.SKU }}</q-item-label>
        </q-item-section>
        <q-item-section side><q-chip dense color="positive" text-color="white">{{ row.SoldQty }}</q-chip></q-item-section>
      </q-item>
    </q-list>

    <q-list bordered separator class="rounded-borders">
      <q-item-label header>
        <div class="row items-center">
          <span>Restock Items</span>
          <q-space />
          <q-btn dense flat icon="add" label="Add" @click="$emit('add-restock')" />
        </div>
      </q-item-label>
      <q-item v-if="!restockRows.length">
        <q-item-section><q-item-label>No restock rows.</q-item-label></q-item-section>
      </q-item>
      <q-item v-for="(row, index) in restockRows" :key="`${row.SKU}-${index}`">
        <q-item-section>
          <q-select dense outlined :model-value="row.SKU" :options="skuOptions" emit-value map-options label="SKU" @update:model-value="$emit('update-restock', index, { SKU: $event })" />
        </q-item-section>
        <q-item-section side>
          <div class="row items-center q-gutter-xs no-wrap">
            <q-input dense outlined type="number" class="qty-input" :model-value="row.Quantity" @update:model-value="$emit('update-restock', index, { Quantity: Number($event || 0) })" />
            <q-btn flat round color="negative" icon="delete" @click="$emit('remove-restock', index)" />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <q-list bordered separator class="rounded-borders">
      <q-item-label header>Submit Options</q-item-label>
      <q-item v-for="option in checklistRows" :key="option.key">
        <q-item-section>
          <q-item-label>{{ option.label }}</q-item-label>
          <q-item-label caption>{{ option.caption }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle :model-value="checklist[option.key]" :disable="option.disable" @update:model-value="$emit('update-checklist', { [option.key]: $event })" />
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'OutletConsumptionSummaryStep' })
const props = defineProps({
  soldRows: { type: Array, default: () => [] },
  restockRows: { type: Array, default: () => [] },
  skuOptions: { type: Array, default: () => [] },
  checklist: { type: Object, required: true },
  hasVisit: { type: Boolean, default: false }
})
defineEmits(['update-restock', 'add-restock', 'remove-restock', 'update-checklist'])

const checklistRows = computed(() => [
  { key: 'completeVisit', label: 'Complete selected visit', caption: props.hasVisit ? 'Marks the selected planned visit completed.' : 'No selected visit.', disable: !props.hasVisit },
  { key: 'scheduleNextVisit', label: 'Schedule next visit', caption: 'Creates the next planned visit from the outlet visit frequency.', disable: false },
  { key: 'generateInvoice', label: 'Generate invoice', caption: 'Creates a zero-value invoice until pricing is designed.', disable: false },
  { key: 'placeRestock', label: 'Place restock request', caption: 'Creates a restock draft from restock rows.', disable: !props.restockRows.length },
  { key: 'submitRestock', label: 'Submit restock immediately', caption: 'Moves created restock to pending approval.', disable: !props.checklist.placeRestock }
])
</script>

<style scoped>
.qty-input {
  width: 86px;
}
</style>
