<template>
  <q-page padding class="q-pb-xl">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <HeaderPanel
          title="Outlet Returns"
          subtitle="Track sales returns and unsold inventory returns from outlets"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <ResourceReports class="q-mb-md" />

    <!-- Search Input -->
    <div class="q-mb-md">
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

    <template v-else>
      <AqlList v-if="activeTab === 'active'" item-key="Code" :items="activeItems" :layout="['label', 'label', 'caption', 'caption']"
        :highlight-color="item => getProgressMeta(item.Progress).color"
        :content="[
          item => outletName(item.OutletCode),
          item => skuName(item.SKU),
          item => `Qty: ${item.Qty} | ${formatDisplayDate(item.Date)}`,
          item => getProgressMeta(item.Progress).label
        ]"
        @click="row => navigateTo(row.Code)"
      />
      <AqlList v-else item-key="Code" :items="completedItems" :layout="['label', 'label', 'caption']" :meta-layout="['chip']"
        :highlight-color="item => getProgressMeta(item.Progress).color"
        :content="[
          item => outletName(item.OutletCode),
          item => skuName(item.SKU),
          item => `Qty: ${item.Qty} | ${formatDisplayDate(item.Date)}`
        ]"
        :meta="[item => getProgressMeta(item.Progress).label]" :chip-color="item => getProgressMeta(item.Progress).color"
        @click="row => navigateTo(row.Code)"
      />
    </template>

    <DataAddFAB tooltip="Log New Return" />
  </q-page>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useOutletReturns } from '../../../composables/operations/outlets/useOutletReturns.js'
import AqlList from '../../../components/shared/AqlList.vue'
import HeaderPanel from '../../../components/shared/HeaderPanel.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import DataAddFAB from '../../../components/shared/DataAddFAB.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'
import ResourceReports from 'components/Reports/ResourceReports.vue'

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
