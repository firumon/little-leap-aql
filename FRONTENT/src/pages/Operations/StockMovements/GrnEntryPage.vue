<template>
  <q-page padding>
    <div class="q-mb-md">
      <h1 class="text-h5 q-mt-none q-mb-sm">GRN Stock Entry</h1>
      <div class="text-caption text-grey-8">
        {{ pageCaption }}
      </div>
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="!selectedWarehouse">
      <div v-if="warehouses.length === 0" class="text-center q-pa-lg text-grey-8">
        No active warehouses found.
      </div>
      <div v-else class="row q-col-gutter-md">
        <div v-for="warehouse in warehouses" :key="warehouse.Code" class="col-12 col-sm-6 col-md-4">
          <q-card class="cursor-pointer" flat bordered v-ripple @click="selectWarehouse(warehouse)">
            <q-card-section>
              <div class="text-h6">{{ warehouse.Name }}</div>
              <div class="text-subtitle2 text-grey-8">{{ warehouse.Code }}</div>
              <div v-if="warehouse.City" class="text-caption q-mt-xs text-grey-6">{{ warehouse.City }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="row q-col-gutter-sm items-center q-mb-md">
        <div class="col-12 col-sm-auto">
          <q-btn flat icon="arrow_back" label="Change Warehouse" color="primary" @click="selectWarehouse(null)" />
        </div>
        <div class="col-12 col-sm">
          <q-select
            :model-value="selectedGrnCode"
            :options="eligibleGrns"
            option-label="label"
            option-value="Code"
            emit-value
            map-options
            outlined
            dense
            clearable
            label="Eligible GRN"
            @update:model-value="selectGrn"
          />
        </div>
      </div>

      <div v-if="eligibleGrns.length === 0" class="text-center q-pa-lg text-grey-8">
        No unposted GRNs found for this warehouse.
      </div>

      <div v-else-if="selectedGrn">
        <GrnStockEntryGrid
          :items="selectedItems"
          :allocation-groups="allocationGroups"
          :summary="allocationSummary"
          :storage-options="storageOptions"
          :current-stock-for="currentStockFor"
          @update-allocation="updateAllocation"
          @add-allocation="addAllocation"
          @remove-allocation="removeAllocation"
        />

        <div class="row justify-end q-mt-md">
          <q-btn
            color="primary"
            icon="save"
            label="Post GRN Stock"
            :disable="!canSubmit"
            :loading="submitting"
            @click="submit"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import GrnStockEntryGrid from 'src/components/Operations/StockMovements/GrnStockEntryGrid.vue'
import { useGrnStockEntry } from 'src/composables/operations/stock/useGrnStockEntry'

const {
  loading,
  submitting,
  warehouses,
  selectedWarehouse,
  selectedGrnCode,
  eligibleGrns,
  selectedGrn,
  selectedItems,
  allocationGroups,
  allocationSummary,
  storageOptions,
  canSubmit,
  loadInitialData,
  selectWarehouse,
  selectGrn,
  updateAllocation,
  addAllocation,
  removeAllocation,
  currentStockFor,
  submit
} = useGrnStockEntry()

const pageCaption = computed(() => {
  if (!selectedWarehouse.value) return 'Select a warehouse to begin'
  if (!selectedGrn.value) return `Select an eligible GRN for ${selectedWarehouse.value.Name} (${selectedWarehouse.value.Code})`
  return `Posting ${selectedGrn.value.Code} into ${selectedWarehouse.value.Name} (${selectedWarehouse.value.Code})`
})

onMounted(() => loadInitialData())
</script>
