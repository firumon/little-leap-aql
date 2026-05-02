<template>
  <q-page padding>
    <OutletHeaderPanel :title="delivery?.Code || 'Outlet Delivery'" :subtitle="delivery ? `${outletName(delivery.OutletCode)} · ${delivery.OutletRestockCode} · ${delivery.WarehouseCode}` : ''" class="q-mb-md">
      <template #side><OutletProgressChip :progress="delivery?.Progress" /></template>
    </OutletHeaderPanel>

    <q-card v-if="delivery" class="q-mb-md">
      <q-card-section class="row q-col-gutter-md">
        <div class="col-12 col-md-3"><div class="text-caption text-grey">Outlet</div><div>{{ outletName(delivery.OutletCode) }}</div></div>
        <div class="col-12 col-md-3"><div class="text-caption text-grey">Restock</div><div>{{ delivery.OutletRestockCode }}</div></div>
        <div class="col-12 col-md-3"><div class="text-caption text-grey">Warehouse</div><div>{{ delivery.WarehouseCode }}</div></div>
        <div class="col-12 col-md-3"><div class="text-caption text-grey">Progress</div><OutletProgressChip :progress="delivery.Progress" /></div>
        <div v-for="field in visibleFields" :key="field.name" class="col-12 col-md-4"><div class="text-caption text-grey">{{ field.label }}</div><div>{{ delivery[field.name] }}</div></div>
      </q-card-section>
    </q-card>

    <q-card v-if="delivery" class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Scheduled Items</div>
        <q-markup-table flat bordered dense>
          <thead><tr><th>SKU</th><th>Product</th><th>Storage</th><th class="text-right">Qty</th></tr></thead>
          <tbody><tr v-for="row in parseDeliveryItems(delivery)" :key="`${row.sku}:${row.storage}`"><td>{{ row.sku }}</td><td>{{ skuLabel(row.sku) }}</td><td>{{ row.storage }}</td><td class="text-right">{{ row.qty }}</td></tr></tbody>
        </q-markup-table>
      </q-card-section>
    </q-card>

    <q-card v-if="delivery?.Progress === 'DELIVERED'" class="q-mb-md">
      <q-card-section>
        <div>Delivery completed. Outlet movements are posted with reference {{ delivery.Code }}.</div>
        <q-list v-if="movementLinks.length" dense class="q-mt-sm">
          <q-item v-for="link in movementLinks" :key="link.resource" dense>
            <q-item-section>
              <q-item-label>{{ link.label }}</q-item-label>
              <q-item-label caption>{{ link.resource }} · {{ link.referenceType }} · {{ link.referenceCode }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
    <q-card v-if="delivery?.Progress === 'CANCELLED'" class="q-mb-md">
      <q-card-section>
        <div>Delivery cancelled. Warehouse stock reversal movements are posted with reference {{ delivery.Code }}.</div>
        <q-list v-if="movementLinks.length" dense class="q-mt-sm">
          <q-item v-for="link in movementLinks" :key="link.resource" dense>
            <q-item-section>
              <q-item-label>{{ link.label }}</q-item-label>
              <q-item-label caption>{{ link.resource }} · {{ link.referenceType }} · {{ link.referenceCode }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <div v-if="delivery?.Progress === 'SCHEDULED'" class="row justify-end q-gutter-sm">
      <q-btn color="negative" outline label="Cancel" :loading="saving" @click="confirmCancel" />
      <q-btn color="positive" label="Deliver" :loading="saving" @click="deliverDelivery(delivery.Code)" />
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute } from 'vue-router'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletDeliveriesViewPage' })
const $q = useQuasar()
const route = useRoute()
const flow = useOutletDeliveries()
const { saving, reloadView, getDelivery, parseDeliveryItems, deliverDelivery, cancelDelivery, outletName, skuLabel, movementLinksForDelivery } = flow
const delivery = computed(() => getDelivery(route.params.code))
const visibleFields = computed(() => ['ScheduledAt', 'DeliveredAt', 'CancelledAt', 'ScheduledBy', 'DeliveredBy', 'CancelledBy'].map(name => ({ name, label: name.replace(/([A-Z])/g, ' $1').trim() })).filter(field => delivery.value?.[field.name]))
const movementLinks = computed(() => movementLinksForDelivery(delivery.value))
function confirmCancel() { $q.dialog({ title: 'Cancel Delivery', message: 'Reverse warehouse reservation for this scheduled delivery?', prompt: { model: '', type: 'textarea', label: 'Cancellation comment' }, cancel: true, persistent: true }).onOk(comment => cancelDelivery(delivery.value.Code, comment)) }
onMounted(() => reloadView())
</script>
