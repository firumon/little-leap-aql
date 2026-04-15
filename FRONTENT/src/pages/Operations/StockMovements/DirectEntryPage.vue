<template>
  <q-page padding>
    <div class="q-mb-md">
      <h1 class="text-h5 q-mt-none q-mb-sm">Direct Stock Entry</h1>
      <div class="text-caption text-grey-8">
        {{ selectedWarehouse ? `Entering stock for ${selectedWarehouse.Name} (${selectedWarehouse.Code})` : 'Select a warehouse to begin' }}
      </div>
    </div>

    <!-- Step 1: Warehouse Selection -->
    <div v-if="!selectedWarehouse">
      <div v-if="loadingWarehouses" class="flex flex-center q-pa-xl">
        <q-spinner color="primary" size="3em" />
      </div>
      <div v-else-if="warehouses.length === 0" class="text-center q-pa-lg text-grey-8">
        No active warehouses found.
      </div>
      <div v-else class="row q-col-gutter-md">
        <div v-for="wh in warehouses" :key="wh.Code" class="col-12 col-sm-6 col-md-4">
          <q-card class="cursor-pointer" v-ripple @click="selectedWarehouse = wh">
            <q-card-section>
              <div class="text-h6">{{ wh.Name }}</div>
              <div class="text-subtitle2 text-grey-8">{{ wh.Code }}</div>
              <div v-if="wh.City" class="text-caption q-mt-xs text-grey-6">{{ wh.City }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Step 2: Editable Stock Register -->
    <div v-else>
      <q-btn flat icon="arrow_back" label="Change Warehouse" color="primary" @click="selectedWarehouse = null" class="q-mb-md" />
      <StockEntryGrid :warehouseCode="selectedWarehouse.Code" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import StockEntryGrid from 'src/components/Operations/StockMovements/StockEntryGrid.vue'
import { useStockMovements } from 'src/composables/useStockMovements'

const { loadWarehouses } = useStockMovements()

const warehouses = ref([])
const loadingWarehouses = ref(true)
const selectedWarehouse = ref(null)

onMounted(async () => {
  loadingWarehouses.ref = true
  warehouses.value = await loadWarehouses()
  loadingWarehouses.value = false
})
</script>
