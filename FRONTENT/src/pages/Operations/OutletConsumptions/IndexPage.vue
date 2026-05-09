<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Outlet Consumptions</div>
      <q-space />
      <q-input v-model="searchTerm" dense outlined placeholder="Search" class="q-mr-sm" />
      <q-btn icon="refresh" flat round :loading="loading" @click="reload(true)" />
    </div>

    <q-list v-if="groups.length" class="q-gutter-y-sm">
      <q-expansion-item
        v-for="group in groups"
        :key="group.key"
        :label="group.meta.label"
        :caption="`${group.items.length} records`"
        :model-value="isGroupExpanded(group.key)"
        header-class="bg-grey-2 text-weight-bold"
        class="shadow-1 rounded-borders overflow-hidden"
        @update:model-value="toggleGroup(group.key, $event)"
      >
        <q-list separator>
          <q-item v-for="row in group.items" :key="row.Code" clickable @click="navigateTo(row.Code)">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ outletName(row.OutletCode) }} · {{ formatDisplayDate(row.Date) }}</q-item-label>
              <q-item-label caption>{{ row.Code }} · {{ row.Username }} · Qty {{ consumedTotal(row.Code) }} · {{ childInvoice(row.Code)?.Code || 'No invoice' }}</q-item-label>
            </q-item-section>
            <q-item-section side><OutletProgressChip :progress="row.Progress" /></q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </q-list>
    <div v-else-if="loading" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>
    <div v-else class="text-center q-pa-xl text-grey">No outlet consumptions found.</div>

    <q-page-sticky position="bottom-right" :offset="[18, 18]"><q-btn fab icon="add" color="primary" @click="navigateToAdd" /></q-page-sticky>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletConsumptionIndexPage' })
const flow = useOutletConsumption()
const { loading, searchTerm, groups, reload, navigateTo, navigateToAdd, consumedTotal, childInvoice, outletName, formatDisplayDate, isGroupExpanded, toggleGroup } = flow
onMounted(() => reload())
</script>
