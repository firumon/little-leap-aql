<template>
  <div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center no-wrap">
        <q-icon :name="statusIcon" :color="statusColor" size="sm" class="q-mr-sm" />
        <div class="col">
          <div class="text-subtitle1">{{ outletName }}</div>
          <div class="text-caption text-grey-7">{{ restock.Date }} · {{ restock.RequestedUser }} · {{ restock.Code }}</div>
        </div>
        <OutletProgressChip :progress="restock.Progress" />
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="text-caption">
          <div><span class="text-grey-7">Requested By:</span> {{ restock.RequestedUser }}</div>
          <div><span class="text-grey-7">Approved By:</span> {{ restock.ApprovedUser || '—' }}</div>
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="hasComments" flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Comments</div>
        <template v-for="(entry, ei) in commentSections" :key="ei">
          <q-separator v-if="ei > 0" class="q-mb-sm" />
          <div class="text-caption text-weight-medium" :class="entry.colorClass">{{ entry.title }}:</div>
          <div class="text-caption" v-html="entry.html" />
        </template>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Items</div>
        <q-list dense bordered separator class="rounded-borders">
          <template v-for="(group, gIdx) in groupedByProduct" :key="gIdx">
            <q-item-label header class="text-caption text-weight-medium text-grey-8 q-px-sm q-py-xs">
              {{ group.productLabel }}
            </q-item-label>
            <q-item v-for="(row, iIdx) in group.items" :key="iIdx" class="q-px-sm q-py-xs">
              <q-item-section>
                <q-item-label class="text-caption">{{ row.variantLabel || row.SKU }}</q-item-label>
                <q-item-label v-if="isApprovedOrBeyond && row.allocations.length" caption>
                  <q-badge v-for="(alloc, ai) in row.allocations" :key="ai" outline color="grey-7" :label="`${alloc.storage_name} · ${alloc.quantity}`" class="q-mr-xs" />
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge :color="statusColor" :label="row.Quantity" />
              </q-item-section>
            </q-item>
          </template>
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
  formatWorkflowCommentHtml: { type: Function, required: true },
  allocations: { type: Function, required: true }
})

const progress = computed(() => text(props.restock.Progress))
const isApprovedOrBeyond = computed(() => ['APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(progress.value))
const statusIcon = computed(() => {
  const map = { APPROVED: 'check_circle', PARTIALLY_DELIVERED: 'local_shipping', DELIVERED: 'done_all', REJECTED: 'cancel' }
  return map[progress.value] || 'inventory_2'
})
const statusColor = computed(() => {
  const map = { APPROVED: 'positive', PARTIALLY_DELIVERED: 'info', DELIVERED: 'positive', REJECTED: 'negative' }
  return map[progress.value] || 'grey-7'
})

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

const groupedByProduct = computed(() => {
  const groups = new Map()
  props.rows.forEach(row => {
    const sku = props.skuOptions.find(s => s.value === row.SKU)
    const parts = (sku?.label || row.SKU).split(' · ')
    const productLabel = parts.length > 1 ? (parts[1] || '') : (parts[0] || row.SKU)
    const variantLabel = parts.length > 2 ? parts.slice(2).join(' · ') : (parts[0] || row.SKU)
    if (!groups.has(productLabel)) groups.set(productLabel, { productLabel, items: [] })
    groups.get(productLabel).items.push({
      ...row,
      variantLabel,
      allocations: isApprovedOrBeyond.value ? props.allocations(row) : []
    })
  })
  return Array.from(groups.values())
})
</script>
