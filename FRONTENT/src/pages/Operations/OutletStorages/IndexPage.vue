<template>
  <q-page padding>
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Stock"
          :subtitle="'Total quantity: ' + totalQty"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <!-- Filters & Search Combo (Below Header Card) -->
    <div class="row items-center q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-6">
        <q-select
          v-model="selectedOutletCode"
          :options="outletOptions"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Outlet"
          hide-bottom-space
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="searchTerm"
          dense
          outlined
          clearable
          placeholder="Search SKU..."
          hide-bottom-space
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
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
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
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
