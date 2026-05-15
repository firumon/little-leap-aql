<template>
  <q-item class="q-px-sm q-py-xs">
    <q-item-section>
      <q-item-label class="text-caption text-weight-medium">{{ row.SKUName }}</q-item-label>
      <q-item-label caption>{{ row.WarehouseCode }} / {{ row.StorageName }} - Qty {{ row.Quantity }}</q-item-label>
    </q-item-section>
    <q-item-section side>
      <OutletProgressChip :progress="row.Progress" />
    </q-item-section>
    <q-item-section v-if="canDeliver && row.Progress !== 'DELIVERED'" side>
      <q-btn flat round dense icon="check_circle" color="positive" @click="$emit('deliver', row)" />
    </q-item-section>
  </q-item>
</template>

<script setup>
import OutletProgressChip from './OutletProgressChip.vue'
defineOptions({ name: 'OutletDeliveryItemRow' })
defineProps({
  row: { type: Object, required: true },
  canDeliver: { type: Boolean, default: false }
})
defineEmits(['deliver'])
</script>
