<template>
  <div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center no-wrap">
        <q-icon name="pending_actions" color="secondary" size="sm" class="q-mr-sm" />
        <div class="col">
          <div class="text-subtitle1">{{ outletName }}</div>
          <div class="text-caption text-grey-7">{{ restock.Date }} - {{ restock.RequestedUser }}</div>
        </div>
        <OutletProgressChip :progress="restock.Progress" />
      </q-card-section>
    </q-card>

    <ResourceReports class="q-mb-md" />

    <q-banner v-if="restock.ProgressSubmittedComment" class="bg-orange-1 text-dark q-mb-md" rounded>
      <div class="text-caption text-weight-medium q-mb-xs">Submission Comment</div>
      <div v-html="formatWorkflowCommentHtml(restock.ProgressSubmittedComment)" />
    </q-banner>

    <q-banner v-if="restock.ProgressRevisionRequiredComment" class="bg-orange-1 text-dark q-mb-md" rounded>
      <div class="text-caption text-weight-medium q-mb-xs">Revision Required</div>
      <div v-html="formatWorkflowCommentHtml(restock.ProgressRevisionRequiredComment)" />
    </q-banner>

    <div class="text-subtitle2 q-mb-sm">Non-Pending Items</div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <q-list v-if="nonPendingRows.length"  class="rounded-borders" separator>
          <q-item v-for="row in nonPendingRows" :key="row.Code || `${row.SKU}-${row.StorageName}`" class="q-px-sm q-py-xs">
            <q-item-section>
              <q-item-label caption lines="1">{{ row.Quantity }}x {{ row.labelWithoutSku }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip size="sm">{{ row.Progress || 'PENDING' }}</q-chip>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-caption text-grey-6">No non-pending items yet.</div>
      </q-card-section>
    </q-card>

    <div v-for="group in reactivePendingGroups" :key="group.key" class="q-mb-lg">
      <div class="row items-center q-mb-sm">
        <div class="text-subtitle2" :class="`text-${groupColor(group.key)}`">{{ group.title }}</div>
      </div>

      <q-banner v-if="!group.rows.length" dense class="bg-grey-1 text-grey-7" rounded>
        No pending items in this group.
      </q-banner>

      <OrsiAllocationRow
        v-for="rowView in group.rows"
        :key="rowView.rowKey"
        :row-view="rowView"
        class="q-mb-sm"
        @apply-recommendation="$emit('apply-recommendation', $event)"
        @update-allocation-line="$emit('update-allocation-line', $event)"
        @reset-allocation="$emit('reset-allocation', $event)"
      />
    </div>

    <div class="text-subtitle2 q-mb-sm">Allocation Summary</div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <q-list v-if="allocationSummary.length">
          <template v-for="allocation in allocationSummary" :key="allocation.itemLabel">
            <q-item class="q-px-none" dense>
              <q-item-section>
                <q-item-label header class="text-bold text-primary">{{ allocation.itemLabel }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip size="md">{{ allocation.allocatedQty }}/{{ allocation.requestedQty }}</q-chip>
              </q-item-section>
            </q-item>
            <q-item v-for="rowView in allocation.allocationSummaryRows" :key="rowView.skuCode + rowView.storageName">
              <q-item-section top>
                <q-item-label>{{ rowView.storageName }}</q-item-label>
                <q-item-label caption>{{ rowView.warehouseName }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label>Allocated: {{ rowView.allocatedQty || 0 }}/{{ rowView.availableQty || 0 }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
        <div v-else class="text-caption text-grey-6">No pending allocations selected yet.</div>
      </q-card-section>
      <q-card-actions align="right" class="bg-grey-2">
        <q-btn color="positive" label="Allocate Selected" :loading="allocateLoading" :disable="!allocationSummary.length" @click="$emit('allocate-selected')" />
      </q-card-actions>
    </q-card>

    <div class="text-subtitle2 q-mb-sm">Cancel Pending Items</div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <q-list v-if="cancelablePendingRows.length" class="rounded-borders" separator>
          <q-item v-for="row in cancelablePendingRows" :key="row.Code" tag="label" class="q-px-sm q-py-xs">
            <q-item-section side>
              <q-checkbox :model-value="!!row._cancelSelected" @update:model-value="selected => $emit('toggle-cancel-item', { code: row.Code, selected })" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption lines="1">{{ row.Quantity }}x {{ row.labelWithoutSku }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip size="sm" color="orange" text-color="white">Pending</q-chip>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-caption text-grey-6">No pending items available to cancel.</div>
        <q-input v-model="cancelComment" type="textarea" label="Cancel Comment" outlined rows="3" class="q-mt-md" />
      </q-card-section>
      <q-card-actions align="right" class="bg-grey-2">
        <q-btn color="negative" label="Cancel Selected" :loading="cancelLoading" :disable="!hasCancelSelection || !cancelComment.trim()" @click="$emit('cancel-selected', cancelComment)" />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import OutletProgressChip from './OutletProgressChip.vue'
import OrsiAllocationRow from './OrsiAllocationRow.vue'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import ResourceReports from "../../Reports/ResourceReports.vue";

defineOptions({ name: 'RestockPendingAllocationView' })

const props = defineProps({
  restock: { type: Object, required: true },
  rows: { type: Array, required: true },
  skuOptions: { type: Array, required: true },
  pendingGroups: { type: Array, required: true },
  hasAllocatedRows: { type: Boolean, default: false },
  outletName: { type: String, default: '' },
  allocateLoading: { type: Boolean, default: false },
  cancelLoading: { type: Boolean, default: false },
  formatWorkflowCommentHtml: { type: Function, required: true }
})

defineEmits(['apply-recommendation', 'update-allocation-line', 'reset-allocation', 'toggle-cancel-item', 'cancel-selected', 'allocate-selected'])

const cancelComment = ref('')
watch(() => props.cancelLoading, (loading, wasLoading) => {
  if (wasLoading && !loading) cancelComment.value = ''
})
const reactivePendingGroups = computed(() => props.pendingGroups)
const summaryRows = computed(() => reactivePendingGroups.value.flatMap(group => group.rows || []))
const allocationSummary = computed(() => summaryRows.value.filter(row => row.allocatedQty > 0))
const decoratedRows = computed(() => props.rows.map(decorateRow))
const nonPendingRows = computed(() => decoratedRows.value
  .filter(row => text(row.Progress) !== 'PENDING' && text(row.Code) && !text(row._approvalSourceKey))
)
const cancelablePendingRows = computed(() => decoratedRows.value
  .filter(row => text(row.Progress) === 'PENDING' && text(row.Code))
)
const hasCancelSelection = computed(() => cancelablePendingRows.value.some(row => row._cancelSelected))

function decorateRow(row = {}) {
  const label = props.skuOptions.find(s => s.value === row.SKU)?.label || row.SKU
  return { ...row, label, labelWithoutSku: skuLabelWithoutCode(label, row.SKU) }
}

function skuLabelWithoutCode(label = '', skuCode = '') {
  const value = text(label)
  const code = text(skuCode)
  if (!code) return value
  return value.replace(new RegExp(`^${escapeRegExp(code)}\\s*·\\s*`), '') || value
}

function escapeRegExp(value = '') {
  return text(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function groupColor(key) {
  return key === 'full' ? 'positive' : key === 'partial' ? 'orange' : 'grey-6'
}
</script>
