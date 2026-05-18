<template>
  <div class="q-gutter-sm">
    <q-banner v-if="!rows.length" rounded class="bg-grey-2 text-grey-8">
      No outlet stock rows found for this outlet.
    </q-banner>

    <q-card v-for="(row, index) in rows" :key="row.SKU" flat bordered class="q-mb-sm">
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

        <!-- Controls: +/- with input, overcount warning inline -->
        <div class="row items-center justify-center q-gutter-md q-my-sm">
          <q-btn
            unelevated
            round
            color="primary"
            icon="remove"
            size="md"
            @click="$emit('decrement', index)"
          />
          <div class="column items-center">
            <q-input
              outlined
              type="number"
              dense
              input-class="text-center text-h6 text-weight-bold"
              style="width: 96px"
              :model-value="row.CurrentQty"
              @update:model-value="$emit('update-current', index, $event)"
            />
            <q-chip
              v-if="row.CurrentQty > row.SystemQty"
              dense
              size="sm"
              color="warning"
              text-color="black"
              icon="warning"
              class="q-mt-xs"
            >
              Over count
            </q-chip>
          </div>
          <q-btn
            unelevated
            round
            color="primary"
            icon="add"
            size="md"
            @click="$emit('increment', index)"
          />
        </div>

        <!-- Sold + Restock info together -->
        <div class="row items-center justify-center q-gutter-sm">
          <q-chip dense square color="positive" text-color="white">
            Sold: {{ row.SoldQty }}
          </q-chip>
          <q-chip dense square color="info" text-color="white">
            Restock: {{ row.SoldQty }}
          </q-chip>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
defineOptions({ name: 'OutletConsumptionStockCountStep' })
defineProps({ rows: { type: Array, default: () => [] } })
defineEmits(['update-current', 'increment', 'decrement'])

function displayName(row) {
  if (row.SkuLabel) {
    const parts = row.SkuLabel.split(' / ')
    if (parts.length > 1) return parts.slice(1).join(' / ')
    return row.SkuLabel
  }
  return row.SKU
}
</script>
