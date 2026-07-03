<template>
  <q-card flat bordered>
    <q-card-section class="row items-center no-wrap">
      <q-icon name="local_shipping" color="primary" size="sm" class="q-mr-sm" />
      <div class="col">
        <div class="text-subtitle1">{{ delivery.Code }}</div>
        <div class="text-caption text-grey-7">{{ summary.outlets.join(', ') || 'No outlets' }}</div>
        <div class="text-caption">{{ summary.delivered }}/{{ summary.total }} delivered - Qty {{ summary.quantity }}</div>
      </div>
      <OutletProgressChip :progress="delivery.Progress" />
    </q-card-section>
  </q-card>
</template>

<script setup>
import OutletProgressChip from './OutletProgressChip.vue'
defineOptions({ name: 'OutletDeliverySummaryPanel' })
defineProps({
  delivery: { type: Object, required: true },
  summary: { type: Object, default: () => ({ total: 0, delivered: 0, outlets: [], quantity: 0 }) }
})
</script>
