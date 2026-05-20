<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div>
        <div class="text-h6">Outlet Stock</div>
        <div class="text-caption text-grey-7">Total quantity: {{ totalQty }}</div>
      </div>
      <q-space />
      <q-select
        v-model="selectedOutletCode"
        :options="outletOptions"
        dense
        outlined
        clearable
        emit-value
        map-options
        label="Outlet"
        style="min-width:260px"
      />
      <q-input v-model="searchTerm" dense outlined placeholder="Search" class="q-ml-sm" />
      <ReloadButton />
    </div>

    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />
    <div v-if="shouldBlockUi" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>
    <OutletStockRows
      v-else
      :rows="stockRows"
      :sku-label="skuLabel"
      :outlet-label="outletLabel"
      @select="row => navigateTo(row.Code)"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useOutletStock } from '../../../composables/operations/outlets/useOutletStock.js'
import OutletStockRows from '../../../components/Operations/Outlets/OutletStockRows.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'OutletStoragesIndexPage' })

const flow = useOutletStock()
const { hasUninitiatedDependencies } = useResourceReload()
const {
  loading,
  searchTerm,
  selectedOutletCode,
  stockRows,
  outletOptions,
  totalQty,
  reload,
  skuLabel,
  outletLabel,
  navigateTo
} = flow

const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)

onMounted(() => reload())
</script>
