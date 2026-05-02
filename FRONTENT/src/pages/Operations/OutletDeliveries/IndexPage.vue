<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Outlet Deliveries</div>
      <q-space />
      <q-input v-model="searchTerm" dense outlined placeholder="Search" class="q-mr-sm" />
      <q-btn icon="refresh" flat round :loading="loading" @click="reloadIndex(true)" />
    </div>

    <q-list bordered>
      <q-expansion-item v-for="group in groups" :key="group.key" :model-value="expandedGroup === group.key" :label="group.meta.label" :caption="`${group.items.length} deliveries`" expand-icon-toggle @show="setExpandedGroup(group.key)">
        <q-list separator>
          <q-item v-for="row in group.items" :key="row.Code" clickable @click="navigateTo(row.Code)">
            <q-item-section>
              <q-item-label>{{ row.Code }} · {{ outletName(row.OutletCode) }}</q-item-label>
              <q-item-label caption>{{ row.OutletRestockCode }} · {{ row.ScheduledAt || 'Not scheduled' }} · {{ itemsSummary(row.ItemsJSON) }}</q-item-label>
            </q-item-section>
            <q-item-section side><OutletProgressChip :progress="row.Progress" /></q-item-section>
          </q-item>
          <q-item v-if="!group.items.length"><q-item-section class="text-grey">No deliveries in this group.</q-item-section></q-item>
        </q-list>
      </q-expansion-item>
    </q-list>

    <q-page-sticky position="bottom-right" :offset="[18, 18]"><q-btn fab icon="add" color="primary" @click="navigateToAdd" /></q-page-sticky>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletDeliveriesIndexPage' })
const flow = useOutletDeliveries()
const { loading, searchTerm, groups, expandedGroup, reloadIndex, navigateTo, navigateToAdd, setExpandedGroup, itemsSummary, outletName } = flow
onMounted(() => reloadIndex())
</script>
