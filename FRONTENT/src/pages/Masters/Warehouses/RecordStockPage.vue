<template>
  <q-page padding>
    <div class="row items-start justify-between q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm">
        <h1 class="text-h5 q-mt-none q-mb-xs">{{ currentWarehouse?.Name || codeLabel }}</h1>
        <div class="text-caption text-grey-8">Current warehouse stock by SKU and storage.</div>
      </div>
      <div class="col-12 col-sm-auto row q-gutter-xs">
        <q-btn flat dense icon="list" label="All Warehouses" color="primary" @click="goToStockList" />
        <q-btn flat dense icon="refresh" label="Refresh" color="primary" :loading="loading" @click="loadData(true)" />
      </div>
    </div>

    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-4">
        <q-card flat bordered><q-card-section><div class="text-caption text-grey-7">SKUs</div><div class="text-h6">{{ stockSummary.skuCount }}</div></q-card-section></q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Storage Locations</div><div class="text-h6">{{ stockSummary.storageCount }}</div></q-card-section></q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Total Quantity</div><div class="text-h6">{{ stockSummary.quantity }}</div></q-card-section></q-card>
      </div>
    </div>

    <q-input
      v-model="searchTerm"
      outlined
      dense
      clearable
      placeholder="Search SKU, product, variant, or storage"
      class="q-mb-md"
    >
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>
    <WarehouseStockRows v-else :rows="filteredStockRows" />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useWarehouseStockList } from 'src/composables/masters/warehouses/useWarehouseStockList'
import WarehouseStockRows from 'src/components/Masters/Warehouses/WarehouseStockRows.vue'

const { code } = useResourceConfig()
const {
  loading,
  searchTerm,
  currentWarehouse,
  filteredStockRows,
  stockSummary,
  loadData,
  goToStockList
} = useWarehouseStockList()

const codeLabel = computed(() => code.value || 'Warehouse Stock')

onMounted(() => loadData())
</script>
