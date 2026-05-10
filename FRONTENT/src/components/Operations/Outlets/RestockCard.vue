<template>
  <q-card flat bordered class="restock-card" :class="urgencyBorderClass">
    <q-card-section class="row items-start no-wrap q-pa-md">
      <q-icon :name="progressIcon" :color="progressColor" size="sm" class="q-mt-xs q-mr-sm" />
      <div class="col min-width-0">
        <div class="text-subtitle2 ellipsis restock-card__outlet">{{ outletLabel || restock.OutletCode }}</div>
        <div class="text-caption text-grey-7">{{ dateLine }}</div>
      </div>
      <div class="restock-card__chip">
        <OutletProgressChip :progress="restock.Progress" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import OutletProgressChip from './OutletProgressChip.vue'
import { progressMeta, text, formatDate } from '../../../composables/operations/outlets/outletOperationsMeta.js'

defineOptions({ name: 'RestockCard' })

const props = defineProps({
  restock: { type: Object, required: true },
  outletLabel: { type: String, default: '' }
})

const progress = computed(() => props.restock?.Progress || '')
const meta = computed(() => progressMeta(progress.value))
const progressColor = computed(() => meta.value.color)
const progressIcon = computed(() => {
  const map = { DRAFT: 'edit_note', PENDING_APPROVAL: 'hourglass_top', REVISION_REQUIRED: 'feedback',
    APPROVED: 'check_circle', PARTIALLY_DELIVERED: 'local_shipping', DELIVERED: 'done_all', REJECTED: 'cancel' }
  return map[text(progress.value)] || 'inventory_2'
})
const urgencyBorderClass = computed(() => {
  const map = { DRAFT: 'border-grey', PENDING_APPROVAL: 'border-orange', REVISION_REQUIRED: 'border-warning',
    APPROVED: 'border-positive', PARTIALLY_DELIVERED: 'border-info', DELIVERED: 'border-positive', REJECTED: 'border-negative' }
  return map[text(progress.value)] || ''
})
const dateLine = computed(() => {
  const parts = [formatDate(props.restock.Date)]
  if (text(props.restock.RequestedUser)) parts.push(text(props.restock.RequestedUser))
  return parts.join(' · ')
})
</script>

<style scoped>
.restock-card {
  border-left: 3px solid transparent;
  transition: box-shadow 0.15s ease;
}
.restock-card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); }
.border-grey { border-left-color: #9e9e9e; }
.border-orange { border-left-color: #f97316; }
.border-warning { border-left-color: #f4c430; }
.border-positive { border-left-color: #22c55e; }
.border-info { border-left-color: #3b82f6; }
.border-negative { border-left-color: #ef4444; }
.restock-card__outlet { line-height: 1.3; }
.restock-card__chip { flex-shrink: 0; margin-left: 8px; }
</style>
