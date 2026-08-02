<template>
  <div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center no-wrap">
        <q-icon name="hourglass_top" color="orange" size="sm" class="q-mr-sm" />
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

    <div v-for="group in approvalGroups" :key="group.key" class="q-mb-lg">
      <div class="row items-center q-mb-sm">
        <div class="text-subtitle2" :class="`text-${groupColor(group.key)}`">{{ group.title }}</div>
      </div>

      <q-banner v-if="!group.rows.length" dense class="bg-grey-1 text-grey-7" rounded>
        No items in this group.
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
                <q-item-label caption>{{ rowView.warehouseName }} </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label>Allocated: {{ rowView.allocatedQty || 0 }}/{{ rowView.availableQty || 0 }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <q-item class="q-px-none" dense>
            <q-item-section>
              <q-item-label header class="text-bold text-secondary">Pending Items for Later Allocation</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip size="md" color="secondary" text-color="white">{{ pendingSummaryQty }}</q-chip>
            </q-item-section>
          </q-item>
          <q-item v-for="rowView in pendingSummary" :key="rowView.rowKey">
            <q-item-section top>
              <q-item-label>{{ rowView.itemLabel }}</q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-item-label>Pending: {{ rowView.pendingQty || 0 }}</q-item-label>
              <q-item-label caption>Requested: {{ rowView.requestedQty }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="!pendingSummary.length" dense>
            <q-item-section>
              <q-item-label caption>No pending items.</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-caption text-grey-6">No allocations selected yet.</div>
      </q-card-section>
      <q-card-actions align="right" class="bg-grey-2">
        <q-btn color="positive" label="Allocate and Approve" :loading="approveLoading" :disable="!hasAllocatedRows" @click="$emit('approve', comment)" />
      </q-card-actions>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <q-input v-model="comment" type="textarea" label="Action Comment (required for Send Back / Reject)" outlined />
      </q-card-section>
      <q-card-actions class="bg-grey-2">
        <q-btn color="negative" label="Reject" :loading="rejectLoading" :disable="!comment.trim()" @click="$emit('reject', comment)" />
        <q-space />
        <q-btn color="warning" label="Send Back" :loading="sendBackLoading" :disable="!comment.trim()" @click="$emit('send-back', comment)" />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import OutletProgressChip from './OutletProgressChip.vue'
import OrsiAllocationRow from './OrsiAllocationRow.vue'
import ResourceReports from "../../Reports/ResourceReports.vue";

defineOptions({ name: 'RestockApprovalView' })

const props = defineProps({
  restock: { type: Object, required: true },
  approvalGroups: { type: Array, required: true },
  hasAllocatedRows: { type: Boolean, default: false },
  outletName: { type: String, default: '' },
  approveLoading: { type: Boolean, default: false },
  sendBackLoading: { type: Boolean, default: false },
  rejectLoading: { type: Boolean, default: false },
  formatWorkflowCommentHtml: { type: Function, required: true }
})

defineEmits(['apply-recommendation', 'update-allocation-line', 'reset-allocation', 'approve', 'send-back', 'reject'])

const comment = ref('')
const summaryRows = computed(() => props.approvalGroups.flatMap(group => group.rows || []))
const allocationSummary = computed(() => summaryRows.value.filter(row => row.allocatedQty > 0))
const pendingSummary = computed(() => summaryRows.value.filter(row => row.pendingQty > 0))
const pendingSummaryQty = computed(() => pendingSummary.value.reduce((total, row) => total + (Number(row.pendingQty) || 0), 0))

function groupColor(key) {
  return key === 'full' ? 'positive' : key === 'partial' ? 'orange' : 'grey-6'
}

function shortWarehouseName(value = '') {
  const label = String(value || '')
  return label.length > 8 ? `${label.slice(0, 8)}..` : label
}
</script>
