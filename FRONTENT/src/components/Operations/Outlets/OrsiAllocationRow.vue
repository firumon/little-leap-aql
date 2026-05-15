<template>
  <q-card flat bordered :class="{ 'bg-green-1': isFullyAllocated }">
    <q-card-section class="row items-center no-wrap q-pb-none">
      <div class="col text-subtitle2">{{ rowView.itemLabel }}</div>
      <div class="text-caption text-grey-7 q-ml-sm">
        <q-chip :label="'Allocated ' + rowView.allocatedQty + ' of ' + rowView.requestedQty" outline />
      </div>
      <div class="q-ml-sm">
        <q-btn v-if="rowView.canApplyRecommendation" color="primary" icon="auto_fix_high" @click="$emit('apply-recommendation', rowView.rowKey)" round push glossy size="sm" />
        <q-btn v-if="rowView.isAllocated" color="grey-8" icon="restart_alt" @click="$emit('reset-allocation', rowView.rowKey)"  round push glossy size="sm" />
      </div>
    </q-card-section>

    <q-card-section>
      <div v-if="pendingRemainderQty > 0 && rowView.allocatedQty > 0" class="bg-orange-1 text-orange-10 q-py-xs q-px-sm flex items-center q-mb-md">
        <div class="text-subtitle2 text-weight-bold">Quantity move to Pending</div><q-space />
        <q-chip color="orange-9" text-color="white" :label="pendingRemainderQty" square />
      </div>

      <q-list v-if="rowView.storageCandidates.length" dense separator>
        <q-item v-for="line in rowView.storageCandidates" :key="line.id">
          <q-item-section>
            <q-item-label>{{ line.storageName }}</q-item-label>
            <q-item-label caption>{{ (line.warehouseName || line.warehouseCode || '') }}</q-item-label>
          </q-item-section>
          <q-item-section class="text-right">{{ line.available }} /</q-item-section>
          <q-item-section>
            <q-input :model-value="line.quantity" type="number" dense outlined input-class="text-center text-bold" min="0" :max="availableQty(line)" @update:model-value="value => updateQty(line, value)" />
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else-if="rowView.availabilityGroup === 'none'" class="text-caption text-grey-5 q-py-sm">
        No stock available
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'OrsiAllocationRow' })

const props = defineProps({
  rowView: { type: Object, required: true }
})

const emit = defineEmits(['update-allocation-line', 'apply-recommendation', 'reset-allocation'])

const isFullyAllocated = computed(() => props.rowView.allocatedQty === props.rowView.requestedQty && props.rowView.requestedQty > 0)
const pendingRemainderQty = computed(() => Number(props.rowView.pendingQty) || 0)

function availableQty(line = {}) {
  const qty = Number(line.available)
  return Number.isFinite(qty) ? Math.max(0, qty) : 0
}

function updateQty(line = {}, value) {
  const rawQty = value === 0 || value === '0' || value === '' ? 0 : Number(value) || 0
  const qty = Math.min(Math.max(0, rawQty), availableQty(line))
  emit('update-allocation-line', {
    rowKey: props.rowView.rowKey,
    warehouseCode: line.warehouseCode,
    storageName: line.storageName,
    quantity: qty
  })
}
</script>
