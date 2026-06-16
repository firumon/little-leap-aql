<template>
  <div class="readonly-restock q-pa-md">
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center no-wrap">
        <q-icon :name="statusIcon" :color="statusColor" size="sm" class="q-mr-sm" />
        <div class="col">
          <div class="text-subtitle1">{{ outletName }}</div>
          <div class="text-caption text-grey-6">{{ restock.Date }} - {{ restock.RequestedUser }}</div>
        </div>
        <OutletProgressChip :progress="restock.Progress" />
      </q-card-section>
    </q-card>

    <ResourceReports class="q-mb-md" />

    <div class="text-subtitle2 q-mb-sm q-mt-md">Activity</div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-6">
            <div class="text-caption text-grey-6">Requested By</div>
            <div class="text-body2">{{ restock.RequestedUser || '—' }}</div>
          </div>
          <div class="col-6">
            <div class="text-caption text-grey-6">Date</div>
            <div class="text-body2">{{ restock.Date || '—' }}</div>
          </div>
        </div>

        <q-banner v-if="restock.ProgressSubmittedComment" class="bg-orange-1 text-dark q-mb-sm" rounded>
          <div class="text-caption text-weight-medium q-mb-xs">Submitted for Approval</div>
          <div class="text-caption" v-html="formatWorkflowCommentHtml(restock.ProgressSubmittedComment)" />
        </q-banner>

        <q-banner v-if="restock.ProgressRevisionRequiredComment" class="bg-orange-2 text-dark q-mb-sm" rounded>
          <div class="text-caption text-weight-medium q-mb-xs">Revision Required</div>
          <div class="text-caption" v-html="formatWorkflowCommentHtml(restock.ProgressRevisionRequiredComment)" />
        </q-banner>

        <q-banner v-if="restock.ProgressApprovedComment" class="bg-green-1 text-dark q-mb-sm" rounded>
          <div class="text-caption text-weight-medium q-mb-xs">Approved</div>
          <div class="text-caption" v-html="formatWorkflowCommentHtml(restock.ProgressApprovedComment)" />
        </q-banner>

        <q-banner v-if="restock.ProgressRejectedComment" class="bg-red-1 text-dark q-mb-sm" rounded>
          <div class="text-caption text-weight-medium q-mb-xs">Rejected</div>
          <div class="text-caption" v-html="formatWorkflowCommentHtml(restock.ProgressRejectedComment)" />
        </q-banner>

        <div v-if="!hasActivity" class="text-caption text-grey-5 text-center q-pa-md">No activity recorded.</div>
      </q-card-section>
    </q-card>

    <div class="text-subtitle2 q-mb-sm q-mt-md">Items</div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <q-list v-if="decoratedRows.length" class="rounded-borders" separator>
          <q-item v-for="row in decoratedRows" :key="row.Code || `${row.SKU}-${row.StorageName}`" class="q-px-sm q-py-sm">
            <q-item-section>
              <q-item-label class="text-body2">{{ row.labelWithoutSku }}</q-item-label>
              <q-item-label caption>
                {{ row.WarehouseCode || 'No warehouse' }}{{ row.StorageName ? ' · ' + row.StorageName : '' }} · Qty {{ row.Quantity }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <OutletProgressChip :progress="row.Progress || 'PENDING'" size="sm" />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-caption text-grey-6 text-center q-pa-md">No items found.</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import OutletProgressChip from './OutletProgressChip.vue'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import ResourceReports from "../../Reports/ResourceReports.vue";

defineOptions({ name: 'RestockReadonlyView' })

const props = defineProps({
  restock: { type: Object, required: true },
  rows: { type: Array, required: true },
  skuOptions: { type: Array, required: true },
  outletName: { type: String, default: '' },
  formatWorkflowCommentHtml: { type: Function, required: true }
})

const progress = computed(() => text(props.restock.Progress))

const statusIcon = computed(() => ({
  APPROVED: 'check_circle', PARTIALLY_DELIVERED: 'local_shipping', DELIVERED: 'done_all', REJECTED: 'cancel'
}[progress.value] || 'inventory_2'))

const statusColor = computed(() => ({
  APPROVED: 'positive', PARTIALLY_DELIVERED: 'info', DELIVERED: 'positive', REJECTED: 'negative'
}[progress.value] || 'grey-7'))

const hasActivity = computed(() =>
  text(props.restock.ProgressSubmittedComment) ||
  text(props.restock.ProgressRevisionRequiredComment) ||
  text(props.restock.ProgressApprovedComment) ||
  text(props.restock.ProgressRejectedComment)
)

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

const decoratedRows = computed(() => props.rows.map(decorateRow))
</script>

<style scoped>
.readonly-restock {
  max-width: 100%;
}
</style>
