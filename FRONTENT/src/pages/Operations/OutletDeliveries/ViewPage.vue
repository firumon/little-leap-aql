<template>
  <q-page padding class="q-pb-xl">
    <div v-if="!delivery" class="text-center q-pa-xl">
      <q-spinner v-if="loading" color="primary" size="3em" />
      <div v-else class="text-grey">Delivery not found.</div>
    </div>

    <template v-else>
      <OutletDeliverySummaryPanel :delivery="delivery" :summary="summary" class="q-mb-md" />

      <ResourceReports class="q-mb-md" />

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
          <q-separator class="q-my-sm" />
          <q-card-actions class="q-px-none">
            <q-btn v-if="canCancel && canCancelDelivery" color="negative" outline dense label="Cancel Draft" :loading="saving" @click="confirmCancel" />
          </q-card-actions>
        </q-card-section>
      </q-card>

      <div v-if="canDeliver && hasPendingItems && !isCancelled" class="row items-center q-gutter-sm q-mb-sm">
        <q-btn flat dense no-caps label="Select All" icon="select_all" @click="selectAll" />
        <q-btn flat dense no-caps label="Clear" icon="deselect" @click="clearSelection" />
        <q-badge v-if="selectedCount" color="primary" :label="`${selectedCount} selected`" />
      </div>

      <q-card v-for="group in groupedRows" :key="group.key" class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-mb-sm justify-between">
            <q-checkbox
              v-if="canDeliver && hasPendingItems && !isCancelled && !group.items.every(item => item.allDelivered)"
              :model-value="isOutletSelected(group.key)"
              :indeterminate="isOutletIndeterminate(group.key)"
              @update:model-value="toggleOutlet(group.key, group.items)"
              dense
            />
            <span class="text-subtitle2 text-weight-medium">{{ group.outletName }}</span>
            <q-badge class="q-ml-sm" color="grey-5" :label="String(group.items.length)" />
          </div>
          <q-list bordered separator>
            <OutletDeliveryItemRow
              v-for="row in group.items"
              :key="row.key"
              :row="row"
              :can-deliver="canDeliver"
              :selected="selectedCodes.has(row.key)"
              :show-select="canDeliver && hasPendingItems && !isCancelled && !row.allDelivered"
              @deliver="openDeliverDialog(row)"
              @toggle-select="toggleItem(row.key)"
            />
          </q-list>
        </q-card-section>
      </q-card>
    </template>

    <q-page-sticky v-if="canDeliver && hasPendingItems && !isCancelled" position="bottom" :offset="[18, 18]">
      <q-btn color="positive" icon="done_all" :label="`Mark Selected as Delivered (${selectedCount})`" :disable="selectedCount === 0" :loading="saving" @click="openBulkDeliverDialog" />
    </q-page-sticky>

    <q-dialog v-model="deliverDialog" persistent>
      <q-card style="min-width: 360px; max-width: 90vw;">
        <q-card-section class="text-h6">{{ deliverAll ? `Mark ${bulkTargetCodes.length} Items Delivered` : 'Mark Item Delivered' }}</q-card-section>
        <q-card-section>
          <q-input v-model="deliverComment" type="textarea" label="Comment (optional)" outlined rows="2" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="positive" label="Confirm" :loading="saving" @click="handleDeliverConfirm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <ActionCommentDialog
      v-model="cancelDialog"
      title="Cancel Delivery"
      label="Cancellation comment (optional)"
      submit-label="Cancel Draft"
      submit-color="negative"
      :saving="saving"
      @confirm="handleCancelConfirm"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { text } from '../../../composables/operation/outlets/outletOperationsMeta.js'
import { useOutletDeliveries } from '../../../composables/operation/outlets/useOutletDeliveries.js'
import OutletDeliverySummaryPanel from '../../../components/operation/Outlets/OutletDeliverySummaryPanel.vue'
import OutletDeliveryItemRow from '../../../components/operation/Outlets/OutletDeliveryItemRow.vue'
import ActionCommentDialog from '../../../components/shared/ActionCommentDialog.vue'
import ResourceReports from 'components/Reports/ResourceReports.vue'

defineOptions({ name: 'OutletDeliveriesViewPage' })

const $q = useQuasar()
const route = useRoute()
const flow = useOutletDeliveries()
const { loading, saving, reloadView, getDelivery, groupedDeliveryItems, deliverySummary, hasPendingDeliveryItems, hasDeliveredDeliveryItems, markSelectedDelivered, cancelDraft, canDeliver, canCancel, timeAgo, currentUserName } = flow

const delivery = computed(() => getDelivery(route.params.code))
const groupedRows = computed(() => groupedDeliveryItems(route.params.code))
const summary = computed(() => delivery.value ? deliverySummary(delivery.value) : { total: 0, delivered: 0, outlets: [], quantity: 0 })
const hasPendingItems = computed(() => hasPendingDeliveryItems(route.params.code))
const canCancelDelivery = computed(() => delivery.value && text(delivery.value.Progress) === 'DRAFT' && !hasDeliveredDeliveryItems(route.params.code))
const isCancelled = computed(() => delivery.value && text(delivery.value.Progress) === 'CANCELLED')

const selectedCodes = ref(new Set())
const deliverDialog = ref(false)
const cancelDialog = ref(false)
const deliverTarget = ref(null)
const deliverComment = ref('')
const deliverAll = ref(false)
const bulkTargetCodes = ref([])

const selectedCount = computed(() => selectedCodes.value.size)

watch(groupedRows, () => {
  const validKeys = new Set()
  for (const group of groupedRows.value) {
    for (const item of group.items) {
      validKeys.add(item.key)
    }
  }
  const filtered = new Set()
  for (const key of selectedCodes.value) {
    if (validKeys.has(key)) filtered.add(key)
  }
  selectedCodes.value = filtered
})

function isOutletSelected(outletKey) {
  const group = groupedRows.value.find(g => g.key === outletKey)
  if (!group || !group.items.length) return false
  return group.items.every(item => selectedCodes.value.has(item.key))
}

function isOutletIndeterminate(outletKey) {
  const group = groupedRows.value.find(g => g.key === outletKey)
  if (!group || !group.items.length) return false
  const selected = group.items.filter(item => selectedCodes.value.has(item.key)).length
  return selected > 0 && selected < group.items.length
}

function toggleItem(skuKey) {
  const key = text(skuKey)
  if (selectedCodes.value.has(key)) {
    selectedCodes.value.delete(key)
  } else {
    selectedCodes.value.add(key)
  }
  selectedCodes.value = new Set(selectedCodes.value)
}

function toggleOutlet(outletKey, items) {
  const allSelected = items.every(item => selectedCodes.value.has(item.key))
  if (allSelected) {
    for (const item of items) selectedCodes.value.delete(item.key)
  } else {
    for (const item of items) {
      if (!item.allDelivered) selectedCodes.value.add(item.key)
    }
  }
  selectedCodes.value = new Set(selectedCodes.value)
}

function selectAll() {
  for (const group of groupedRows.value) {
    for (const item of group.items) {
      if (!item.allDelivered) selectedCodes.value.add(item.key)
    }
  }
  selectedCodes.value = new Set(selectedCodes.value)
}

function clearSelection() {
  selectedCodes.value = new Set()
}

function formatDeliveryComment() {
  const now = new Date()
  const time = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `Delivered by ${currentUserName()} at ${time}`
}

function openDeliverDialog(skuItem) {
  deliverTarget.value = skuItem
  deliverAll.value = false
  bulkTargetCodes.value = []
  deliverComment.value = formatDeliveryComment()
  deliverDialog.value = true
}

function openBulkDeliverDialog() {
  deliverTarget.value = null
  deliverAll.value = true
  const allCodes = []
  for (const group of groupedRows.value) {
    for (const item of group.items) {
      if (selectedCodes.value.has(item.key)) {
        allCodes.push(...item.orsiCodes)
      }
    }
  }
  bulkTargetCodes.value = allCodes
  deliverComment.value = formatDeliveryComment()
  deliverDialog.value = true
}

async function handleDeliverConfirm() {
  let codesToDeliver
  if (deliverAll.value) {
    codesToDeliver = bulkTargetCodes.value
  } else if (deliverTarget.value) {
    codesToDeliver = deliverTarget.value.orsiCodes || []
  }
  if (!codesToDeliver || !codesToDeliver.length) return
  const result = await markSelectedDelivered(route.params.code, codesToDeliver, deliverComment.value)
  if (result) {
    clearSelection()
    deliverDialog.value = false
  }
}

function confirmCancel() {
  cancelDialog.value = true
}

async function handleCancelConfirm(comment) {
  const ok = await cancelDraft(route.params.code, comment)
  if (ok) {
    cancelDialog.value = false
  }
}

onMounted(() => reloadView())
</script>

