<template>
  <div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center no-wrap">
        <q-icon :name="statusIcon" :color="statusColor" size="sm" class="q-mr-sm" />
        <div class="col">
          <div class="text-subtitle1">{{ outletName }}</div>
          <div class="text-caption text-grey-7">{{ restock.Date }} - {{ restock.RequestedUser }} - {{ restock.Code }}</div>
        </div>
        <OutletProgressChip :progress="restock.Progress" />
      </q-card-section>
    </q-card>

    <q-card v-if="hasComments" flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Comments</div>
        <template v-for="(entry, ei) in commentSections" :key="ei">
          <q-separator v-if="ei > 0" class="q-mb-sm" />
          <div class="text-caption text-weight-medium" :class="entry.colorClass">{{ entry.title }}</div>
          <div class="text-caption" v-html="entry.html" />
        </template>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Items</div>
        <q-list dense bordered separator class="rounded-borders">
          <q-item v-for="row in decoratedRows" :key="row.Code || `${row.SKU}-${row.StorageName}`" class="q-px-sm q-py-xs">
            <q-item-section>
              <q-item-label class="text-caption text-weight-medium">{{ row.label }}</q-item-label>
              <q-item-label caption>
                {{ row.WarehouseCode || 'No warehouse' }} - {{ row.StorageName || 'No storage' }} - Qty {{ row.Quantity }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <OutletProgressChip :progress="row.Progress || 'PENDING'" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import OutletProgressChip from './OutletProgressChip.vue'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'

defineOptions({ name: 'RestockReadonlyView' })

const props = defineProps({
  restock: { type: Object, required: true },
  rows: { type: Array, required: true },
  skuOptions: { type: Array, required: true },
  outletName: { type: String, default: '' },
  formatWorkflowCommentHtml: { type: Function, required: true }
})

const progress = computed(() => text(props.restock.Progress))
const statusIcon = computed(() => ({ APPROVED: 'check_circle', PARTIALLY_DELIVERED: 'local_shipping', DELIVERED: 'done_all', REJECTED: 'cancel' }[progress.value] || 'inventory_2'))
const statusColor = computed(() => ({ APPROVED: 'positive', PARTIALLY_DELIVERED: 'info', DELIVERED: 'positive', REJECTED: 'negative' }[progress.value] || 'grey-7'))
const commentSections = computed(() => {
  const sections = []
  const r = props.restock
  if (text(r.ProgressSubmittedComment)) sections.push({ title: 'Submission', html: props.formatWorkflowCommentHtml(r.ProgressSubmittedComment), colorClass: 'text-grey-7' })
  if (text(r.ProgressRevisionRequiredComment)) sections.push({ title: 'Sent Back', html: props.formatWorkflowCommentHtml(r.ProgressRevisionRequiredComment), colorClass: 'text-warning' })
  if (text(r.ProgressApprovedComment)) sections.push({ title: 'Approval', html: props.formatWorkflowCommentHtml(r.ProgressApprovedComment), colorClass: 'text-positive' })
  if (text(r.ProgressRejectedComment)) sections.push({ title: 'Rejection', html: props.formatWorkflowCommentHtml(r.ProgressRejectedComment), colorClass: 'text-negative' })
  return sections
})
const hasComments = computed(() => commentSections.value.length > 0)
const decoratedRows = computed(() => props.rows.map(row => ({ ...row, label: props.skuOptions.find(s => s.value === row.SKU)?.label || row.SKU })))
</script>
