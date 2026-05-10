<template>
  <q-page padding>
    <!-- Header -->
    <OutletHeaderPanel :title="outletName(delivery?.OutletCode)" :subtitle="headerSubtitle" class="q-mb-md">
      <template #side><OutletProgressChip :progress="delivery?.Progress" /></template>
    </OutletHeaderPanel>

    <!-- Delivery History -->
    <q-card v-if="delivery" class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-md">Delivery History</div>
        <q-timeline dense layout="dense">
          <!-- Restock Submitted -->
          <q-timeline-entry
            v-if="sourceRestock?.ProgressSubmittedAt"
            color="grey"
            icon="note_add"
            title="Restock Requested"
            :subtitle="sourceRestock?.RequestedUser || ''"
          >
            <div>{{ timeAgo(sourceRestock.ProgressSubmittedAt) }}</div>
          </q-timeline-entry>

          <!-- Restock Approved -->
          <q-timeline-entry
            v-if="sourceRestock?.ProgressApprovedAt"
            color="positive"
            icon="thumb_up"
            title="Restock Approved"
            :subtitle="sourceRestock?.ApprovedUser || ''"
          >
            <div>{{ timeAgo(sourceRestock.ProgressApprovedAt) }}</div>
          </q-timeline-entry>

          <!-- Scheduled -->
          <q-timeline-entry
            v-if="delivery.ScheduledAt"
            color="warning"
            icon="schedule"
            title="Scheduled"
            :subtitle="delivery.ScheduledBy || ''"
          >
            <div>{{ timeAgo(delivery.ScheduledAt) }}</div>
          </q-timeline-entry>

          <!-- Delivered -->
          <q-timeline-entry
            v-if="delivery.Progress === 'DELIVERED'"
            color="positive"
            icon="check_circle"
            title="Delivered"
            :subtitle="delivery.DeliveredBy || ''"
          >
            <div>{{ timeAgo(delivery.DeliveredAt) }}</div>
            <div v-if="delivery.DeliveredComment || delivery.ProgressDeliveredComment" class="text-caption text-grey-7 q-mt-xs">
              {{ delivery.DeliveredComment || delivery.ProgressDeliveredComment }}
            </div>
          </q-timeline-entry>

          <!-- Cancelled -->
          <q-timeline-entry
            v-if="delivery.Progress === 'CANCELLED'"
            color="negative"
            icon="cancel"
            title="Cancelled"
            :subtitle="delivery.CancelledBy || ''"
          >
            <div>{{ timeAgo(delivery.CancelledAt) }}</div>
            <div v-if="delivery.ProgressCancelledComment || delivery.Comment" class="text-caption text-grey-7 q-mt-xs">
              {{ delivery.ProgressCancelledComment || delivery.Comment }}
            </div>
          </q-timeline-entry>
        </q-timeline>
      </q-card-section>
    </q-card>

    <!-- Scheduled Items (card-based) -->
    <q-card v-if="delivery" class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Scheduled Items</div>
        <q-list v-if="deliveryItems.length" bordered separator>
          <q-item v-for="row in deliveryItems" :key="`${row.sku}:${row.storage}`" class="q-px-sm q-py-xs">
            <q-item-section>
              <q-item-label class="text-caption text-weight-medium">{{ skuLabel(row.sku) }}</q-item-label>
              <q-item-label caption class="text-caption">Storage: {{ row.storage }} · Qty: {{ row.qty }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge color="primary" :label="String(row.qty)" />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-caption text-grey">No items in this delivery.</div>
      </q-card-section>
    </q-card>

    <!-- Action Bar -->
    <div v-if="['SCHEDULED', 'DELIVERED'].includes(text(delivery?.Progress))" class="row justify-end q-gutter-sm">
      <q-btn v-if="canCancel" color="negative" outline :label="delivery?.Progress === 'DELIVERED' ? 'Reverse Delivery' : 'Cancel Delivery'" :loading="saving" @click="confirmCancel" />
      <q-btn v-if="canDeliver && delivery?.Progress === 'SCHEDULED'" color="positive" icon="check_circle" label="Mark as Delivered" :loading="saving" @click="openDeliverDialog" />
    </div>

    <!-- Deliver Dialog -->
    <q-dialog v-model="deliverDialog" persistent>
      <q-card style="min-width: 380px; max-width: 90vw;">
        <q-card-section class="text-h6">Mark as Delivered</q-card-section>
        <q-card-section v-if="delivery" class="q-gutter-y-sm">
          <div class="text-subtitle2">{{ outletName(delivery.OutletCode) }}</div>
          <div class="text-caption text-grey-7">{{ delivery.Code }} · Scheduled {{ timeAgo(delivery.ScheduledAt) }}</div>
          <div class="text-caption text-grey-7">{{ itemsSummary(delivery.ItemsJSON) }}</div>
          <q-input v-model="deliverComment" type="textarea" label="Comment (optional)" outlined dense autogrow rows="2" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="positive" label="Confirm Delivery" :loading="saving" @click="handleDeliverConfirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import { useOutletDeliveries } from '../../../composables/operations/outlets/useOutletDeliveries.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletDeliveriesViewPage' })

const $q = useQuasar()
const route = useRoute()
const flow = useOutletDeliveries()
const {
  saving, reloadView, getDelivery, getRestock,
  parseDeliveryItems, deliverDelivery, cancelDelivery,
  outletName, skuLabel, itemsSummary,
  canDeliver, canCancel, timeAgo
} = flow

const delivery = computed(() => getDelivery(route.params.code))
const deliveryItems = computed(() => delivery.value ? parseDeliveryItems(delivery.value) : [])

const sourceRestock = computed(() => {
  if (!delivery.value) return null
  return getRestock(delivery.value.OutletRestockCode)
})

const headerSubtitle = computed(() => {
  if (!delivery.value) return ''
  const status = delivery.value.Progress === 'SCHEDULED' ? 'Scheduled' : delivery.value.Progress === 'DELIVERED' ? 'Delivered' : delivery.value.Progress === 'CANCELLED' ? 'Cancelled' : delivery.value.Progress
  const date = delivery.value.DeliveredAt || delivery.value.CancelledAt || delivery.value.ScheduledAt
  return `${delivery.value.WarehouseCode || ''} · ${status} ${date ? timeAgo(date) : ''}`
})

// Deliver dialog
const deliverDialog = ref(false)
const deliverComment = ref('')

function openDeliverDialog() {
  deliverComment.value = ''
  deliverDialog.value = true
}

async function handleDeliverConfirm() {
  const result = await deliverDelivery(delivery.value.Code, deliverComment.value)
  if (result) {
    deliverDialog.value = false
    await reloadView()
  }
}

// Cancel dialog
function confirmCancel() {
  $q.dialog({
    title: 'Cancel Delivery',
    message: 'Reverse warehouse reservation for this scheduled delivery?',
    prompt: { model: '', type: 'textarea', label: 'Cancellation comment (optional)' },
    cancel: true,
    persistent: true
  }).onOk(async (comment) => {
    const result = await cancelDelivery(delivery.value.Code, comment)
    if (result) await reloadView()
  })
}

onMounted(() => reloadView())
</script>
