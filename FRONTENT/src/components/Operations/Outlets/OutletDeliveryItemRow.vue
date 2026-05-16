<template>
  <q-item class="q-px-sm q-py-xs">
    <q-item-section v-if="showSelect" avatar>
      <q-checkbox :model-value="selected" @update:model-value="$emit('toggle-select')" :disable="row.allDelivered" />
    </q-item-section>
    <q-item-section>
      <q-item-label class="text-caption text-weight-medium"><span class="text-primary text-bold text-subtitle1">{{ row.totalQty }}x </span>{{ row.skuName }}</q-item-label>
    </q-item-section>
    <q-item-section side>
      <OutletProgressChip :progress="row.allDelivered ? 'DELIVERED' : 'IN_TRANSIT'" />
    </q-item-section>
  </q-item>
</template>

<script setup>
import OutletProgressChip from './OutletProgressChip.vue'
defineOptions({ name: 'OutletDeliveryItemRow' })
defineProps({
  row: { type: Object, required: true },
  canDeliver: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false }
})
defineEmits(['deliver', 'toggle-select'])
</script>
