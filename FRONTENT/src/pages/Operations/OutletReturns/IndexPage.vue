<template>
  <q-page padding class="q-pb-xl">
    <!-- Header -->
    <div class="q-mb-md">
      <div class="row items-center justify-between no-wrap q-mb-xs">
        <div class="col">
          <div class="text-h6">Outlet Returns</div>
        </div>
        <ReloadButton />
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">Track sales returns and unsold inventory returns from outlets</div>
      <!-- Search input -->
      <div class="col-12 col-sm-6">
        <q-input
          v-model="searchTerm"
          dense
          outlined
          clearable
          placeholder="Search by outlet, SKU, or code..."
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>

      <!-- Tabs -->
      <div class="row justify-center q-mt-sm">
        <q-tabs
          v-model="activeTab"
          narrow-indicator
          dense
          class="text-grey-7"
          active-color="primary"
          indicator-color="primary"
          style="min-width: 250px"
        >
          <q-tab name="active" label="Active" />
          <q-tab name="completed" label="Completed & Cancelled" />
        </q-tabs>
      </div>
    </div>

    <!-- Background loading indicator -->
    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />

    <!-- Initial load spinner -->
    <div v-if="shouldBlockUi" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!filteredItems.length" class="text-center q-pa-xl text-grey-6">
      <q-icon name="assignment_return" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 q-mt-md">No returns found</div>
      <div class="text-caption text-grey-7">Adjust your search or log a new return.</div>
      <q-btn v-if="canCreate" color="primary" icon="add" label="Log New Return" class="q-mt-md" @click="navigateToAdd()" />
    </div>

    <!-- Card list -->
    <div v-else class="row q-col-gutter-sm">
      <div
        v-for="row in filteredItems"
        :key="row.Code"
        class="col-12 col-sm-6 col-md-4 col-lg-3"
      >
        <q-card
          flat
          bordered
          class="cursor-pointer hover-shadow"
          @click="navigateTo(row.Code)"
        >
          <q-card-section class="q-pa-md">
            <div class="row items-center justify-between q-mb-sm no-wrap">
              <span class="text-subtitle1 text-weight-bold text-primary">{{ row.Code }}</span>
              <q-badge
                :color="getProgressMeta(row.Progress).color"
                text-color="white"
                class="q-py-xs q-px-sm text-weight-bold"
              >
                {{ getProgressMeta(row.Progress).label }}
              </q-badge>
            </div>

            <div class="row items-center q-mb-xs no-wrap">
              <q-icon name="storefront" size="16px" color="grey-6" class="q-mr-xs" />
              <span class="text-weight-medium text-dark ellipsis col">{{ outletName(row.OutletCode) }}</span>
            </div>

            <div class="row items-center q-mb-md no-wrap">
              <q-icon name="inventory_2" size="16px" color="grey-6" class="q-mr-xs" />
              <span class="text-grey-8 ellipsis col">{{ skuName(row.SKU) }}</span>
            </div>

            <q-separator class="q-my-sm opacity-50" />

            <div class="row items-center justify-between q-mt-sm">
              <div class="row items-center q-gutter-x-md text-caption text-grey-7">
                <span>Qty: <strong class="text-weight-bold text-dark">{{ row.Qty }}</strong></span>
                <span class="row items-center">
                  <q-icon name="schedule" size="12px" class="q-mr-xs" />
                  {{ formatDisplayDate(row.Date) }}
                </span>
              </div>

              <div class="row q-gutter-x-xs">
                <q-icon
                  v-if="row.InvoiceAdjustmentRequired"
                  name="receipt_long"
                  :color="row.InvoiceAdjustmentDone ? 'positive' : 'warning'"
                  size="18px"
                >
                  <q-tooltip>{{ row.InvoiceAdjustmentDone ? 'Invoice credited' : 'Awaiting invoice credit' }}</q-tooltip>
                </q-icon>
                <q-icon
                  v-if="row.WarehouseActionRequired"
                  name="local_shipping"
                  :color="row.WarehouseActionCompleted ? 'positive' : 'warning'"
                  size="18px"
                >
                  <q-tooltip>{{ row.WarehouseActionCompleted ? 'Stock received at WH' : 'Awaiting warehouse receipt' }}</q-tooltip>
                </q-icon>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Floating Action Button to Add -->
    <q-page-sticky v-if="canCreate" position="bottom-right" :offset="[18, 18]">
      <q-btn
        fab
        icon="add"
        color="primary"
        @click="navigateToAdd()"
      >
        <q-tooltip anchor="top middle" self="bottom middle">Log New Return</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </q-page>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useOutletReturns } from '../../../composables/operations/outlets/useOutletReturns.js'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'OutletReturnsIndexPage' })

const flow = useOutletReturns()
const { hasUninitiatedDependencies } = useResourceReload()
const {
  loading,
  searchTerm,
  activeTab,
  items,
  activeItems,
  completedItems,
  reload,
  getProgressMeta,
  formatDisplayDate,
  skuName,
  outletName,
  navigateTo,
  navigateToAdd,
  canCreate
} = flow

const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)

const filteredItems = computed(() => {
  return activeTab.value === 'active' ? activeItems.value : completedItems.value
})

onMounted(async () => {
  await reload()
})
</script>

<style lang="scss" scoped>
.opacity-50 {
  opacity: 0.5;
}
.hover-shadow {
  transition: box-shadow 0.15s ease-in-out;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}
</style>
