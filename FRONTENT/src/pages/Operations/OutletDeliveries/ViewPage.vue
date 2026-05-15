<template>
  <q-page padding>
    <div v-if="!delivery" class="text-center q-pa-xl">
      <q-spinner v-if="loading" color="primary" size="3em" />
      <div v-else class="text-grey">Delivery not found.</div>
    </div>

    <template v-else>
      <OutletDeliverySummaryPanel :delivery="delivery" :summary="summary" class="q-mb-md" />

      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 q-mb-md">Timeline</div>
          <q-timeline dense layout="dense">
            <q-timeline-entry color="grey" icon="note_add" title="Draft Created" :subtitle="delivery.UserName || ''">
              <div>{{ timeAgo(delivery.Date || delivery.CreatedAt) }}</div>
            </q-timeline-entry>
            <q-timeline-entry v-if="delivery.ProgressInTransitAt" color="primary" icon="local_shipping" title="In Transit" :subtitle="delivery.ProgressInTransitBy || ''">
              <div>{{ timeAgo(delivery.ProgressInTransitAt) }}</div>
              <div class="text-caption text-grey-7">{{ delivery.ProgressInTransitComment }}</div>
            </q-timeline-entry>
            <q-timeline-entry v-if="delivery.ProgressCompletedAt" color="positive" icon="done_all" title="Completed" :subtitle="delivery.ProgressCompletedBy || ''">
              <div>{{ timeAgo(delivery.ProgressCompletedAt) }}</div>
              <div class="text-caption text-grey-7">{{ delivery.ProgressCompletedComment }}</div>
            </q-timeline-entry>
            <q-timeline-entry v-if="delivery.CancelledAt" color="negative" icon="cancel" title="Cancelled" :subtitle="delivery.CancelledBy || ''">
              <div>{{ timeAgo(delivery.CancelledAt) }}</div>
              <div class="text-caption text-grey-7">{{ delivery.CancelledComment }}</div>
            </q-timeline-entry>
          </q-timeline>
        </q-card-section>
      </q-card>

      <q-card v-for="group in groupedRows" :key="group.key" class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">{{ group.outletName }}</div>
          <q-list bordered separator>
            <OutletDeliveryItemRow v-for="row in group.items" :key="row.Code" :row="row" :can-deliver="canDeliver" @deliver="openDeliverDialog" />
          </q-list>
        </q-card-section>
      </q-card>

      <div class="row justify-end q-gutter-sm">
        <q-btn v-if="canCancel && canCancelDelivery" color="negative" outline label="Cancel Draft" :loading="saving" @click="confirmCancel" />
        <q-btn v-if="canDeliver && hasPendingItems" color="positive" icon="done_all" label="Mark All Delivered" :loading="saving" @click="openDeliverAllDialog" />
      </div>
    </template>

    <q-dialog v-model="deliverDialog" persistent>
      <q-card style="min-width: 360px; max-width: 90vw;">
        <q-card-section class="text-h6">{{ deliverAll ? 'Mark All Delivered' : 'Mark Item Delivered' }}</q-card-section>
        <q-card-section>
          <q-input v-model="deliverComment" type="textarea" label="Comment (optional)" outlined dense autogrow rows="2" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="positive" label="Confirm" :loading="saving" @click="handleDeliverConfirm" />
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
import OutletDeliverySummaryPanel from '../../../components/Operations/Outlets/OutletDeliverySummaryPanel.vue'
import OutletDeliveryItemRow from '../../../components/Operations/Outlets/OutletDeliveryItemRow.vue'

defineOptions({ name: 'OutletDeliveriesViewPage' })

const $q = useQuasar()
const route = useRoute()
const flow = useOutletDeliveries()
const { loading, saving, reloadView, getDelivery, groupedDeliveryItems, deliverySummary, childDeliveryItems, markItemDelivered, markAllDelivered, cancelDraft, canDeliver, canCancel, timeAgo } = flow

const delivery = computed(() => getDelivery(route.params.code))
const groupedRows = computed(() => groupedDeliveryItems(route.params.code))
const summary = computed(() => delivery.value ? deliverySummary(delivery.value) : { total: 0, delivered: 0, outlets: [], quantity: 0 })
const hasPendingItems = computed(() => childDeliveryItems(route.params.code).some(row => text(row.Progress) !== 'DELIVERED'))
const canCancelDelivery = computed(() => delivery.value && text(delivery.value.Progress) === 'DRAFT' && !childDeliveryItems(route.params.code).some(row => text(row.Progress) === 'DELIVERED'))

const deliverDialog = ref(false)
const deliverTarget = ref(null)
const deliverComment = ref('')
const deliverAll = ref(false)

function openDeliverDialog(row) {
  deliverTarget.value = row
  deliverAll.value = false
  deliverComment.value = ''
  deliverDialog.value = true
}
function openDeliverAllDialog() {
  deliverTarget.value = null
  deliverAll.value = true
  deliverComment.value = ''
  deliverDialog.value = true
}
async function handleDeliverConfirm() {
  const result = deliverAll.value ? await markAllDelivered(route.params.code, deliverComment.value) : await markItemDelivered(deliverTarget.value, deliverComment.value)
  if (result) deliverDialog.value = false
}
function confirmCancel() {
  $q.dialog({
    title: 'Cancel Delivery',
    message: 'Cancel this draft delivery and return linked items to allocated?',
    prompt: { model: '', type: 'textarea', label: 'Cancellation comment (optional)' },
    cancel: true,
    persistent: true
  }).onOk((comment) => cancelDraft(route.params.code, comment))
}

onMounted(() => reloadView())
</script>
