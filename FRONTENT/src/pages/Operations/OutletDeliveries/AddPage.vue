<template>
  <q-page padding>
    <OutletHeaderPanel title="Schedule Outlet Delivery" subtitle="Select an approved restock and reserve warehouse stock" class="q-mb-md" />

    <div v-if="preSelected" class="text-caption text-info q-mb-sm">
      Outlet and items pre-filled from restock {{ selectedRestockCode }}.
      Select a different restock to change.
    </div>

    <!-- Restock Selector -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-select
          v-model="selectedRestockModel"
          :options="restockSelectOptions"
          label="Select Approved Restock"
          outlined
          dense
          emit-value
          map-options
          clearable
        >
          <template #option="{ opt, selected, toggleOption }">
            <q-item clickable @click="toggleOption(opt)" :active="selected">
              <q-item-section>
                <q-item-label>{{ opt.outletLabel }}</q-item-label>
                <q-item-label caption>{{ opt.date }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <OutletProgressChip :progress="opt.progress" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>

      <div class="col-12 col-md-6" v-if="selectedRestockCode">
        <q-select v-model="selectedWarehouseCode" :options="warehouseOptions" label="Warehouse" emit-value map-options outlined dense />
      </div>
    </div>

    <!-- Packing Reference -->
    <q-card v-if="rows.length" class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Packing Reference ({{ rows.length }})</div>
        <q-list bordered separator>
          <q-item v-for="(row, idx) in rows" :key="idx" class="q-px-sm q-py-xs">
            <q-item-section>
              <q-item-label class="text-caption text-weight-medium">{{ row.ProductVariant || skuLabelLocal(row.SKU) }}</q-item-label>
              <q-item-label caption class="text-caption">
                {{ row.SKU }} · {{ row.StorageName }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge color="primary" :label="String(row.Qty || row.Quantity)" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <div class="row justify-end q-gutter-sm q-mt-md">
      <q-btn flat label="Cancel" @click="cancel" />
      <q-btn color="primary" label="Schedule Delivery" :disable="!selectedRestockCode || !selectedWarehouseCode" :loading="saving" @click="scheduleDelivery" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'

defineOptions({ name: 'OutletDeliveriesAddPage' })

const route = useRoute()
const flow = useOutletDeliveries()
const {
  selectedRestockCode, selectedWarehouseCode, rows, saving, eligibleRestocks, warehouseOptions,
  reloadAdd, selectRestock, scheduleDelivery, cancel, outletName, restockCardSummary, skuLabel
} = flow

function skuLabelLocal(code) { return skuLabel(code) }

const preSelected = ref(false)

const restockSelectOptions = computed(() =>
  eligibleRestocks.value.map(r => ({
    label: `${outletName(r.OutletCode)} · ${r.Date || ''}`,
    value: r.Code,
    outletLabel: outletName(r.OutletCode),
    progress: r.Progress,
    date: r.Date
  }))
)

const selectedRestockModel = computed({
  get: () => selectedRestockCode.value || null,
  set: (val) => {
    if (val) {
      preSelected.value = false
      selectRestock(val)
    } else {
      selectedRestockCode.value = ''
      rows.value = []
    }
  }
})

onMounted(async () => {
  await reloadAdd()
  if (route.query.outletRestockCode) {
    preSelected.value = true
    selectRestock(route.query.outletRestockCode)
  }
})
</script>
