<template>
  <q-page padding class="q-pb-xl">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Deliveries"
          subtitle="Delivery headers with item-level tracking"
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
        <AqlList item-key="Code" dense :items="group.items" :layout="['label', 'caption', 'caption']" :meta-layout="['chip']"
          :content="[
            item => item.UserName || 'Unknown',
            item => timeAgo(item.Date || item.CreatedAt),
            item => `${deliverySummary(item).delivered}/${deliverySummary(item).total} delivered`
          ]"
          :meta="[item => progressMeta(item.Progress).label]" :chip-color="item => progressMeta(item.Progress).color"
          @click="row => navigateTo(row.Code)"
        />
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
import AqlList from '../../../components/shared/AqlList.vue'
import { progressMeta } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import OutletHeaderPanel from '../../../components/shared/OutletHeaderPanel.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import DataAddFAB from '../../../components/shared/DataAddFAB.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'
import ResourceReports from 'components/Reports/ResourceReports.vue'

defineOptions({ name: 'OutletDeliveriesIndexPage' })

const flow = useOutletDeliveries()
const { hasUninitiatedDependencies } = useResourceReload()
const { loading, searchTerm, items, groups, availableItems, reloadIndex, navigateTo, navigateToAdd, deliverySummary, timeAgo, canCreate } = flow
const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)

onMounted(async () => {
  await reloadIndex()
})
</script>
