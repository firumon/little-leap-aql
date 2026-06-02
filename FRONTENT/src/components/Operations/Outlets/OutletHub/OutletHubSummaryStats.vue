<template>
  <div class="row q-col-gutter-xs q-mb-md">
    <div class="col-6 col-sm-3">
      <q-card flat bordered class="bg-blue-1 q-pa-sm text-center">
        <div class="text-caption text-grey-7 text-weight-bold">Planned Visits</div>
        <div class="text-h6 text-weight-bold text-primary">{{ plannedVisits.length }}</div>
      </q-card>
    </div>
    <div class="col-6 col-sm-3">
      <q-card flat bordered class="bg-orange-1 q-pa-sm text-center">
        <div class="text-caption text-grey-7 text-weight-bold">Pending Restocks</div>
        <div class="text-h6 text-weight-bold text-orange-9">{{ pendingRestocks.length }}</div>
      </q-card>
    </div>
    <div class="col-6 col-sm-3">
      <q-card flat bordered class="bg-purple-1 q-pa-sm text-center">
        <div class="text-caption text-grey-7 text-weight-bold">Open Returns</div>
        <div class="text-h6 text-weight-bold text-purple">{{ pendingReturns.length }}</div>
      </q-card>
    </div>
    <div class="col-6 col-sm-3">
      <q-card flat bordered class="bg-red-1 q-pa-sm text-center">
        <div class="text-caption text-grey-7 text-weight-bold">Total Outstanding</div>
        <div class="text-h6 text-weight-bold text-negative">{{ formatMoney(totalOutstanding) }}</div>
      </q-card>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'OutletHubSummaryStats' })

defineProps({
  plannedVisits: { type: Array, required: true },
  pendingRestocks: { type: Array, required: true },
  pendingReturns: { type: Array, required: true },
  totalOutstanding: { type: Number, required: true },
  formatMoney: { type: Function, required: true }
})
</script>
