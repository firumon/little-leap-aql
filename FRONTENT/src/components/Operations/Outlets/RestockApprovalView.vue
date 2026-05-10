<template>
  <div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center no-wrap">
        <q-icon name="hourglass_top" color="orange" size="sm" class="q-mr-sm" />
        <div class="col">
          <div class="text-subtitle1">{{ outletName }}</div>
          <div class="text-caption text-grey-7">{{ restock.Date }} · {{ restock.RequestedUser }}</div>
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

    <q-banner v-if="restock.ProgressSubmittedComment" class="bg-orange-1 text-dark q-mb-md" rounded>
      <div class="text-caption text-weight-medium q-mb-xs">Submission Comment</div>
      <div v-html="formatWorkflowCommentHtml(restock.ProgressSubmittedComment)" />
    </q-banner>
    <q-banner v-if="restock.ProgressRevisionRequiredComment" class="bg-orange-1 text-dark q-mb-md" rounded>
      <div class="text-caption text-weight-medium q-mb-xs">Revision Required</div>
      <div v-html="formatWorkflowCommentHtml(restock.ProgressRevisionRequiredComment)" />
    </q-banner>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Items</div>
        <div v-for="(row, rowIndex) in rows" :key="row.Code || rowIndex" class="q-pa-sm q-mb-sm rounded-borders bg-grey-2"
          :style="`border-left: 3px solid var(--q-${availIcon(row).color})`">
          <div class="row items-center no-wrap q-mb-xs">
            <div class="col text-caption text-weight-medium ellipsis">{{ skuProduct(row.SKU) }}</div>
            <div class="text-caption text-grey-7 q-mx-sm ellipsis">{{ skuVariant(row.SKU) }}</div>
            <div class="text-caption text-weight-bold text-right" style="white-space: nowrap;">
              {{ allocationTotal(row) }}/{{ row.Quantity }}
              <q-icon v-if="allocationTotal(row) === row.Quantity" name="check_circle" color="positive" size="xs" class="q-ml-xs" />
              <q-icon v-else-if="allocationTotal(row) > row.Quantity" name="warning" color="warning" size="xs" class="q-ml-xs" />
            </div>
          </div>
          <div v-for="s in storagesFor(row, rowIndex)" :key="s.storage"
            class="row items-center q-ml-md q-mb-xs q-gutter-xs">
            <q-checkbox
              :model-value="s.selected"
              dense size="xs"
              @update:model-value="val => toggleStorage(rowIndex, s, val)"
            />
            <div class="col text-caption ellipsis">{{ s.label.split(" · ").slice(0,2).join(" · ") }}</div>
            <div class="text-caption text-grey-6 text-bold" style="white-space: nowrap;">{{ s.available }}</div>
            <q-input class="q-ml-md" input-class="text-center text-bold"
              :disable="!s.selected"
              :model-value="s.quantity"
              type="number"
              dense outlined
              min="0"
              :max="s.available"
              style="max-width: 70px"
              @update:model-value="val => updateStorageQty(rowIndex, s, Number(val))"
            />
          </div>
        </div>
      </q-card-section>
      <q-card-actions align="right" class="bg-grey-2">
        <q-btn color="positive" label="Approve" :loading="approveLoading" :disable="!allAllocated" @click="$emit('approve', comment)" />
      </q-card-actions>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <q-input v-model="comment" type="textarea" label="Action Comment (required for Send Back / Reject)" outlined rows="4" />
      </q-card-section>
      <q-card-actions class="bg-grey-2">
        <q-btn color="negative" label="Reject" :loading="rejectLoading" @click="$emit('reject', comment)" />
        <q-space />
        <q-btn color="warning" label="Send Back" :loading="sendBackLoading" @click="$emit('send-back', comment)" />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import OutletProgressChip from './OutletProgressChip.vue'

defineOptions({ name: 'RestockApprovalView' })

const props = defineProps({
  restock: { type: Object, required: true },
  rows: { type: Array, required: true },
  skuOptions: { type: Array, required: true },
  outletName: { type: String, default: '' },
  approveLoading: { type: Boolean, default: false },
  sendBackLoading: { type: Boolean, default: false },
  rejectLoading: { type: Boolean, default: false },
  formatWorkflowCommentHtml: { type: Function, required: true },
  allocations: { type: Function, required: true },
  allocationTotal: { type: Function, required: true },
  allocationAvailability: { type: Function, required: true },
  allocationAvailableTotal: { type: Function, required: true },
  updateAllocation: { type: Function, required: true },
  addAllocation: { type: Function, required: true },
  removeAllocation: { type: Function, required: true }
})

defineEmits(['approve', 'send-back', 'reject'])

const comment = ref('')

const allAllocated = computed(() => {
  return props.rows.every(row => {
    const allocTotal = props.allocationTotal(row)
    const req = Number(row.Quantity) || 0
    return allocTotal >= req
  })
})

function skuProduct(skuCode) {
  const sku = props.skuOptions.find(s => s.value === skuCode)
  if (!sku) return skuCode
  const parts = sku.label.split(' · ')
  return parts.length > 1 ? (parts[1] || skuCode) : skuCode
}
function skuVariant(skuCode) {
  const sku = props.skuOptions.find(s => s.value === skuCode)
  if (!sku) return ''
  const parts = sku.label.split(' · ')
  return parts.length > 2 ? parts.slice(2).join(' · ') : ''
}

function availIcon(row) {
  const avail = props.allocationAvailableTotal(row)
  const req = Number(row.Quantity) || 0
  if (avail >= req) return { icon: 'check_circle', color: 'positive' }
  if (avail <= 0) return { icon: 'cancel', color: 'negative' }
  return { icon: 'warning', color: 'warning' }
}

function storagesFor(row, rowIndex) {
  const avail = props.allocationAvailability(row) || []
  const allocs = props.allocations(row) || []
  return avail.map(s => {
    const match = allocs.find(a => a.storage_name === s.value)
    return {
      storage: s.value,
      label: s.label,
      available: s.available,
      selected: !!match,
      quantity: match ? match.quantity : 0,
      allocIdx: match ? allocs.indexOf(match) : -1
    }
  })
}

function toggleStorage(rowIndex, s, checked) {
  if (checked) {
    props.addAllocation(rowIndex)
    const allocs = props.allocations(props.rows[rowIndex])
    const newIdx = allocs.length - 1
    props.updateAllocation(rowIndex, newIdx, { storage_name: s.storage, quantity: Math.min(s.available, 1) })
  } else if (s.allocIdx >= 0) {
    props.removeAllocation(rowIndex, s.allocIdx)
  }
}

function updateStorageQty(rowIndex, s, val) {
  const qty = Number.isFinite(val) ? Math.max(0, Math.min(val, s.available)) : 0
  if (s.allocIdx >= 0) {
    props.updateAllocation(rowIndex, s.allocIdx, { quantity: qty })
  } else {
    props.addAllocation(rowIndex)
    const allocs = props.allocations(props.rows[rowIndex])
    const newIdx = allocs.length - 1
    props.updateAllocation(rowIndex, newIdx, { storage_name: s.storage, quantity: qty })
  }
}
</script>
