<template>
  <q-page padding>
    <div v-if="!restock" class="text-center q-pa-xl">
      <q-spinner v-if="loading" color="primary" size="3em" />
      <div v-else class="text-grey">Restock not found.</div>
    </div>

    <RestockDraftView
      v-else-if="mode === 'editable'"
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
      :rows="rows"
      :sku-options="skuOptions"
      :outlet-name="outletLabel(restock.OutletCode)"
      :approve-loading="approveLoading"
      :send-back-loading="sendBackLoading"
      :reject-loading="rejectLoading"
      :format-workflow-comment-html="formatWorkflowCommentHtml"
      :allocations="allocations"
      :allocation-total="allocationTotal"
      :allocation-availability="allocationAvailability"
      :allocation-available-total="allocationAvailableTotal"
      :update-allocation="updateAllocation"
      :add-allocation="addAllocation"
      :remove-allocation="removeAllocation"
      @approve="handleApprove"
      @send-back="handleSendBack"
      @reject="handleReject"
    />

    <RestockReadonlyView
      v-else
      :restock="restock"
      :rows="rows"
      :sku-options="skuOptions"
      :outlet-name="outletLabel(restock.OutletCode)"
      :format-workflow-comment-html="formatWorkflowCommentHtml"
      :allocations="allocations"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletRestocks } from '../../../composables/operations/outlets/useOutletRestocks.js'
import RestockDraftView from '../../../components/Operations/Outlets/RestockDraftView.vue'
import RestockApprovalView from '../../../components/Operations/Outlets/RestockApprovalView.vue'
import RestockReadonlyView from '../../../components/Operations/Outlets/RestockReadonlyView.vue'

defineOptions({ name: 'OutletRestocksViewPage' })

const route = useRoute()
const flow = useOutletRestocks()

const {
  form, rows, skuOptions, saving, loading,
  reloadView, loadRestock, getRestock,
  saveRestockDraft, submitRestock, approveRestock, sendBackRestock, rejectRestock,
  resolveRestockViewMode,
  addRow, updateRow, removeRow,
  allocations, allocationTotal, allocationAvailability, allocationAvailableTotal,
  updateAllocation, addAllocation, removeAllocation,
  formatWorkflowCommentHtml
} = flow

const restock = computed(() => getRestock(route.params.code))
const mode = computed(() => resolveRestockViewMode(restock.value?.Progress))

const approveLoading = ref(false)
const sendBackLoading = ref(false)
const rejectLoading = ref(false)

function outletLabel(code) {
  const outlet = (flow.outletOptions?.value || []).find(o => o.value === code)
  if (!outlet) return code
  const parts = outlet.label.split(' · ')
  return parts.length > 1 ? parts.slice(1).join(' · ') : outlet.label
}

async function handleSaveDraft() { await saveRestockDraft(false) }
async function handleSubmit(comment = '') { await submitRestock(restock.value, comment) }
async function handleApprove(comment = '') { approveLoading.value = true; try { await approveRestock(restock.value, rows.value, comment) } finally { approveLoading.value = false } }
async function handleSendBack(comment = '') { sendBackLoading.value = true; try { await sendBackRestock(restock.value, comment) } finally { sendBackLoading.value = false } }
async function handleReject(comment = '') { rejectLoading.value = true; try { await rejectRestock(restock.value, comment) } finally { rejectLoading.value = false } }

onMounted(async () => {
  await reloadView()
  loadRestock(route.params.code)
})
</script>
