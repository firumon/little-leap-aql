<template>
  <q-page padding>
    <OutletHeaderPanel title="Schedule Outlet Delivery" subtitle="Select an approved restock and reserve warehouse stock" class="q-mb-md" />

    <div class="row q-col-gutter-md q-mb-md">
      <div v-for="restock in eligibleRestocks" :key="restock.Code" class="col-12 col-md-6 col-lg-4">
        <q-card :class="selectedRestockCode === restock.Code ? 'bg-blue-1 text-primary' : ''" bordered clickable @click="selectRestock(restock.Code)">
          <q-card-section>
            <div class="row items-center no-wrap">
              <div>
                <div class="text-subtitle1 text-weight-medium">{{ outletName(restock.OutletCode) }}</div>
                <div class="text-caption text-grey-7">{{ restock.Code }} · {{ restock.Date || restock.ProgressApprovedAt || 'Approved' }}</div>
              </div>
              <q-space />
              <q-icon v-if="selectedRestockCode === restock.Code" name="check_circle" color="primary" />
            </div>
            <div class="text-caption q-mt-sm">{{ restockCardSummary(restock) }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card v-if="selectedRestockCode" class="q-mb-md">
      <q-card-section class="row q-col-gutter-md">
        <q-select class="col-12 col-md-6" v-model="selectedWarehouseCode" :options="warehouseOptions" label="Warehouse" emit-value map-options outlined />
      </q-card-section>
    </q-card>

    <q-card v-if="rows.length">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Packing Reference</div>
        <OutletItemGrid :items="rows" show-storage :quantity-columns="[{ name: 'Qty', label: 'Scheduled Qty', readonly: true }]" />
      </q-card-section>
    </q-card>

    <div class="row justify-end q-gutter-sm q-mt-md">
      <q-btn flat label="Cancel" @click="cancel" />
      <q-btn color="primary" label="Schedule Delivery" :disable="!selectedRestockCode || !selectedWarehouseCode" :loading="saving" @click="scheduleDelivery" />
    </div>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletItemGrid from '../../../components/Operations/Outlets/OutletItemGrid.vue'

defineOptions({ name: 'OutletDeliveriesAddPage' })
const flow = useOutletDeliveries()
const { selectedRestockCode, selectedWarehouseCode, rows, saving, eligibleRestocks, warehouseOptions, reloadAdd, selectRestock, scheduleDelivery, cancel, outletName, restockCardSummary } = flow
onMounted(() => reloadAdd())
</script>
