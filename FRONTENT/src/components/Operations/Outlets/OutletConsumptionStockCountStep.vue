<template>
  <div class="column q-gutter-sm">
    <q-banner v-if="!rows.length" rounded class="bg-grey-2 text-grey-8">No outlet stock rows found for this outlet.</q-banner>
    <q-card v-for="(row, index) in rows" :key="row.SKU" flat bordered>
      <q-card-section class="q-pa-sm">
        <div class="row items-start q-col-gutter-sm">
          <div class="col">
            <div class="text-subtitle2 text-weight-medium">{{ row.ProductName }}</div>
            <div class="text-caption text-grey-7">{{ row.SkuLabel || row.SKU }}</div>
          </div>
          <div class="col-auto text-right">
            <div class="text-caption text-grey-6">System</div>
            <div class="text-subtitle2">{{ row.SystemQty }}</div>
          </div>
        </div>

        <div class="row items-center no-wrap q-gutter-xs q-mt-sm">
          <q-btn unelevated round color="grey-3" text-color="dark" icon="remove" size="md" @click="$emit('decrement', index)" />
          <q-input class="count-input" dense outlined type="number" :model-value="row.CurrentQty" @update:model-value="$emit('update-current', index, $event)" />
          <q-btn unelevated round color="grey-3" text-color="dark" icon="add" size="md" @click="$emit('increment', index)" />
          <q-btn unelevated color="primary" label="0" class="quick-btn" @click="$emit('set-zero', index)" />
          <q-btn unelevated color="primary" label="Same" class="quick-btn" @click="$emit('set-system', index)" />
        </div>

        <div class="row items-center justify-between q-mt-sm">
          <q-chip dense square color="positive" text-color="white">Sold {{ row.SoldQty }}</q-chip>
          <q-chip v-if="row.CurrentQty > row.SystemQty" dense color="warning" text-color="black">Variance</q-chip>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
defineOptions({ name: 'OutletConsumptionStockCountStep' })
defineProps({ rows: { type: Array, default: () => [] } })
defineEmits(['update-current', 'increment', 'decrement', 'set-zero', 'set-system'])
</script>

<style scoped>
.count-input {
  width: 88px;
  flex: 0 0 88px;
}
.quick-btn {
  min-width: 52px;
}
</style>
