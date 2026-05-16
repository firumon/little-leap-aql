<template>
  <q-page padding class="q-pb-xl">
    <div class="q-mb-md">
      <div class="row items-center no-wrap q-mb-xs">
        <div class="col">
          <div class="text-h6">Outlet Deliveries</div>
        </div>
        <q-btn icon="refresh" flat round dense :loading="loading" @click="reloadIndex(true)" />
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">Delivery headers with item-level tracking</div>
      <q-input v-model="searchTerm" dense outlined clearable placeholder="Search deliveries..." style="max-width: 480px">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
    </div>

    <q-linear-progress v-if="loading && !isInitialLoad" color="primary" indeterminate class="q-mb-sm" />

    <div v-if="isInitialLoad && loading" class="text-center q-pa-xl">
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

    <q-page-sticky v-if="canCreate" position="bottom-right" :offset="[18, 18]">
      <q-btn fab icon="add" color="primary" @click="navigateToAdd()">
        <q-tooltip anchor="top middle" self="bottom middle">Create Delivery</q-tooltip>
      </q-btn>
    </q-page-sticky>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletDeliveriesIndexPage' })

const flow = useOutletDeliveries()
const { loading, isInitialLoad, searchTerm, items, groups, availableItems, reloadIndex, navigateTo, navigateToAdd, deliverySummary, timeAgo, canCreate } = flow

onMounted(async () => {
  await reloadIndex()
})
</script>
