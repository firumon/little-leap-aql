<template>
  <q-page padding class="q-pb-xl">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Deliveries"
          subtitle="Delivery headers with item-level tracking"
          :stats="[]"
          class="brand-header-card"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <!-- Search Input -->
    <div class="q-mb-md">
      <q-input
        v-model="searchTerm"
        dense
        outlined
        clearable
        placeholder="Search deliveries..."
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />

    <div v-if="shouldBlockUi" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="!items.length && !availableItems.length" class="text-center q-pa-xl">
      <q-icon name="local_shipping" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 q-mt-md">No deliveries yet</div>
      <div class="text-caption text-grey-7 q-mb-lg">Create a delivery from allocated restock items.</div>
      <q-btn v-if="canCreate" color="primary" icon="add" label="Create Delivery" @click="navigateToAdd()" />
    </div>

    <template v-else>

      <div v-for="group in groups" :key="group.key" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="local_shipping" :color="group.meta.color" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">{{ group.meta.label }}</span>
          <q-badge class="q-ml-sm" :color="group.meta.color" :label="String(group.items.length)" />
        </div>
        <div class="column q-gutter-sm">
          <q-card v-for="row in group.items" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateTo(row.Code)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ row.UserName || 'Unknown' }}</div>
                  <div class="text-caption text-grey-7">{{ timeAgo(row.Date || row.CreatedAt) }}</div>
                </div>
                <q-space />
                <OutletProgressChip :progress="row.Progress" />
              </div>
              <q-separator class="q-my-xs" />
              <div class="text-caption text-grey-7">{{ deliverySummary(row).delivered }}/{{ deliverySummary(row).total }} delivered</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <div v-if="canCreate && availableItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="inventory_2" color="warning" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Allocated Items Ready</span>
          <q-space />
          <q-chip outline class="text-bold q-px-md" color="warning" :label="String(availableItems.length)" />
          <div class="col-12 text-center q-py-sm">
            <q-btn size="sm" color="primary" icon="add" label="Create" @click="navigateToAdd()" />
          </div>
        </div>
      </div>

    </template>

    <DataAddFAB tooltip="Create Delivery" />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import DataAddFAB from '../../../components/shared/DataAddFAB.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'OutletDeliveriesIndexPage' })

const flow = useOutletDeliveries()
const { hasUninitiatedDependencies } = useResourceReload()
const { loading, searchTerm, items, groups, availableItems, reloadIndex, navigateTo, navigateToAdd, deliverySummary, timeAgo, canCreate } = flow
const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)

onMounted(async () => {
  await reloadIndex()
})
</script>
