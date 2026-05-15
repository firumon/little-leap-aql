<template>
  <q-page padding>
    <OutletHeaderPanel title="Create Outlet Delivery" subtitle="Select allocated restock items" class="q-mb-md" />

    <q-input v-model="searchTerm" dense outlined clearable placeholder="Search outlet, SKU, or restock..." class="q-mb-md">
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <AvailableOrsiPanel
      :rows="availableItems"
      :selected-codes="selectedItemCodes"
      @toggle="toggleItem"
      @select-all="selectAllAvailable"
      @clear="clearSelection"
    />

    <div class="row justify-end q-gutter-sm q-mt-md">
      <q-btn flat label="Cancel" @click="cancel" />
      <q-btn color="primary" label="Create Draft" :disable="!selectedItems.length" :loading="saving" @click="createDraft" />
    </div>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import AvailableOrsiPanel from '../../../components/Operations/Outlets/AvailableOrsiPanel.vue'

defineOptions({ name: 'OutletDeliveriesAddPage' })

const flow = useOutletDeliveries()
const { loading, saving, searchTerm, availableItems, selectedItemCodes, selectedItems, reloadAdd, toggleItem, selectAllAvailable, clearSelection, createDraft, cancel } = flow

onMounted(() => reloadAdd())
</script>
