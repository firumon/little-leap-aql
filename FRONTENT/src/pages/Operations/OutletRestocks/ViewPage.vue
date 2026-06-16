<template>
  <q-page padding>
    <div v-if="!restock" class="text-center q-pa-xl">
      <q-spinner v-if="loading" color="primary" size="3em" />
      <div v-else class="text-grey">Restock not found.</div>
    </div>

    <template v-else>
      <!-- Direct Delivery Action Panel -->
      <DirectDeliveryPanel
        v-if="showDeliveryPanel"
        :allocated-items="allocatedItemDetails"
        :saving="saving"
        @deliver="handleDeliver"
      />

      <RestockDraftView
        v-if="mode === 'editable'"
        :restock="restock"
        :rows="rows"
        :sku-options="skuOptions"
        :outlet-name="outletLabel(restock.OutletCode)"
        :saving="saving"
        :format-workflow-comment-html="formatWorkflowCommentHtml"
        :add-row="addRow"
        :update-row="updateRow"
        :remove-row="removeRow"
        @save-draft="handleSaveDraft"
        @submit="handleSubmit"
      />

      <RestockApprovalView
        v-else-if="mode === 'review'"
        :restock="restock"
        :approval-groups="approvalAllocationGroups"
        :has-allocated-rows="hasAllocatedApprovalRows"
        :outlet-name="outletLabel(restock.OutletCode)"
        :approve-loading="approveLoading"
        :send-back-loading="sendBackLoading"
        :reject-loading="rejectLoading"
        :format-workflow-comment-html="formatWorkflowCommentHtml"
        @apply-recommendation="handleApplyRecommendation"
        @update-allocation-line="handleUpdateCandidateLine"
        @reset-allocation="handleResetAllocation"
        @approve="handleApprove"
        @send-back="handleSendBack"
        @reject="handleReject"
      />

      <RestockPendingAllocationView
        v-else-if="mode === 'pending-allocation'"
        :restock="restock"
        :rows="rows"
        :sku-options="skuOptions"
        :pending-groups="pendingAllocationGroups"
        :has-allocated-rows="hasNewAllocatedRows"
        :outlet-name="outletLabel(restock.OutletCode)"
        :allocate-loading="allocatePendingLoading"
        :cancel-loading="cancelPendingLoading"
        :format-workflow-comment-html="formatWorkflowCommentHtml"
        @apply-recommendation="handleApplyRecommendation"
        @update-allocation-line="handleUpdatePendingCandidateLine"
        @reset-allocation="handleResetAllocation"
        @toggle-cancel-item="handleToggleCancelItem"
        @cancel-selected="handleCancelPending"
        @allocate-selected="handleAllocatePending"
      />

      <RestockReadonlyView
        v-else-if="mode === 'readonly'"
        :restock="restock"
        :rows="rows"
        :sku-options="skuOptions"
        :outlet-name="outletLabel(restock.OutletCode)"
        :format-workflow-comment-html="formatWorkflowCommentHtml"
      />
    </template>
  </q-page>
</template>


<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletRestocks } from '../../../composables/operations/outlets/useOutletRestocks.js'
import RestockDraftView from '../../../components/Operations/Outlets/RestockDraftView.vue'
import RestockApprovalView from '../../../components/Operations/Outlets/RestockApprovalView.vue'
import RestockPendingAllocationView from '../../../components/Operations/Outlets/RestockPendingAllocationView.vue'
import RestockReadonlyView from '../../../components/Operations/Outlets/RestockReadonlyView.vue'
import DirectDeliveryPanel from '../../../components/Operations/Outlets/DirectDeliveryPanel.vue'
import ResourceReports from 'components/Reports/ResourceReports.vue'

defineOptions({ name: 'OutletRestocksViewPage' })

const route = useRoute()
const flow = useOutletRestocks()

const {
  form, rows, skuOptions, approvalAllocationGroups, pendingAllocationGroups, pendingAllocationDraftRows, hasAllocatedApprovalRows, hasNewAllocatedRows, saving, loading,
  reloadView, loadRestock, getRestock,
  saveRestockDraft, submitRestock, approveRestock, allocatePendingRestockItems, cancelPendingRestockItems, sendBackRestock, rejectRestock, deliverDirectRestock,
  resolveRestockViewMode,
  addRow, updateRow, removeRow,
  applyRecommendedAllocation, updateAllocationLine, updateCandidateLine, updatePendingCandidateLine, cancelPendingSelection, addAllocationSplit, removeAllocationLine, resetAllocation,
  formatWorkflowCommentHtml
} = flow


const restock = computed(() => getRestock(route.params.code))
const hasPendingItems = computed(() => rows.value.some(row => row.Progress === 'PENDING'))
const hasPendingAllocationDraft = computed(() => pendingAllocationDraftRows.value.length > 0)
const mode = computed(() => {
  const resolved = resolveRestockViewMode(restock.value?.Progress)
  return resolved === 'readonly' && restock.value?.Progress === 'APPROVED' && (hasPendingItems.value || hasPendingAllocationDraft.value) ? 'pending-allocation' : resolved
})

const approveLoading = ref(false)
const allocatePendingLoading = ref(false)
const cancelPendingLoading = ref(false)
const sendBackLoading = ref(false)
const rejectLoading = ref(false)

const allocatedItemDetails = computed(() => {
  return rows.value
    .filter(row => row.Progress === 'ALLOCATED')
    .map(row => {
      const match = skuOptions.value.find(opt => opt.value === row.SKU)
      const skuName = match ? match.label : row.SKU
      return {
        ...row,
        SKUName: skuName
      }
    })
})

const showDeliveryPanel = computed(() => {
  const progress = restock.value?.Progress
  return ['APPROVED', 'PARTIALLY_DELIVERED'].includes(progress) && allocatedItemDetails.value.length > 0
})

async function handleDeliver(items, comment) {
  await deliverDirectRestock(restock.value, items, comment)
}

function outletLabel(code) {
  const outlet = (flow.outletOptions?.value || []).find(o => o.value === code)
  if (!outlet) return code
  const parts = outlet.label.split(' · ')
  return parts.length > 1 ? parts.slice(1).join(' · ') : outlet.label
}


async function handleSaveDraft() { await saveRestockDraft(false) }
async function handleSubmit(comment = '') { await submitRestock(restock.value, comment) }
function handleApplyRecommendation(rowKey) { applyRecommendedAllocation(rowKey, mode.value === 'pending-allocation' ? flow.pendingAllocationSourceKey : undefined) }
function handleUpdateCandidateLine(payload = {}) { updateCandidateLine(payload.rowKey, payload.warehouseCode, payload.storageName, payload.quantity) }
function handleUpdatePendingCandidateLine(payload = {}) { updatePendingCandidateLine(payload.rowKey, payload.warehouseCode, payload.storageName, payload.quantity) }
function handleToggleCancelItem(payload = {}) { cancelPendingSelection(payload.code, payload.selected) }
function handleResetAllocation(rowKey) { resetAllocation(rowKey, mode.value === 'pending-allocation' ? flow.pendingAllocationSourceKey : undefined) }
async function handleApprove(comment = '') { approveLoading.value = true; try { await approveRestock(restock.value, rows.value, comment) } finally { approveLoading.value = false } }
async function handleAllocatePending() { allocatePendingLoading.value = true; try { await allocatePendingRestockItems(restock.value, rows.value) } finally { allocatePendingLoading.value = false } }
async function handleCancelPending(comment = '') { cancelPendingLoading.value = true; try { await cancelPendingRestockItems(restock.value, comment) } finally { cancelPendingLoading.value = false } }
async function handleSendBack(comment = '') { sendBackLoading.value = true; try { await sendBackRestock(restock.value, comment) } finally { sendBackLoading.value = false } }
async function handleReject(comment = '') { rejectLoading.value = true; try { await rejectRestock(restock.value, comment) } finally { rejectLoading.value = false } }

onMounted(async () => {
  await reloadView()
  loadRestock(route.params.code)
})
</script>
