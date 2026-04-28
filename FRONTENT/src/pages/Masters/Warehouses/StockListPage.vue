<template>
  <q-page padding>
    <div class="row items-start justify-between q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm">
        <h1 class="text-h5 q-mt-none q-mb-xs">Stock List</h1>
        <div class="text-caption text-grey-8">Select a warehouse to view current stock.</div>
      </div>
      <div class="col-12 col-sm-auto">
        <q-btn flat dense icon="refresh" label="Refresh" color="primary" :loading="loading" @click="loadData(true)" />
      </div>
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="!warehouseCards.length" class="text-center q-pa-lg text-grey-8">
      No active warehouses found.
    </div>

    <div v-else class="row q-col-gutter-md">
      <div v-for="warehouse in warehouseCards" :key="warehouse.Code" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="cursor-pointer" v-ripple @click="viewWarehouseStock(warehouse.Code)">
          <q-card-section>
            <div class="row items-start justify-between no-wrap">
              <div>
                <div class="text-h6">{{ warehouse.Name }}</div>
                <div class="text-subtitle2 text-grey-8">{{ warehouse.Code }}</div>
                <div v-if="warehouse.City" class="text-caption q-mt-xs text-grey-6">{{ warehouse.City }}</div>
              </div>
              <q-icon name="chevron_right" color="grey-6" size="24px" />
            </div>
            <div class="row q-col-gutter-sm q-mt-sm">
              <div class="col-4">
                <q-chip dense square color="blue-1" text-color="blue-10">{{ warehouse.stockSkuCount }} SKUs</q-chip>
              </div>
              <div class="col-4">
                <q-chip dense square color="teal-1" text-color="teal-10">{{ warehouse.stockStorageCount }} stores</q-chip>
              </div>
              <div class="col-4">
                <q-chip dense square color="green-1" text-color="green-10">{{ warehouse.stockQuantity }} qty</q-chip>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useWarehouseStockList } from 'src/composables/masters/warehouses/useWarehouseStockList'

const {
  loading,
  warehouseCards,
  loadData,
  viewWarehouseStock
} = useWarehouseStockList()

onMounted(() => loadData())
</script>
