<template>
  <div class="row q-col-gutter-xs q-mb-md">
    <div v-for="stat in visibleStats" :key="stat.key" class="col-6 col-sm-3">
      <q-card flat bordered class="summary-stat-card cursor-pointer" :class="stat.bgClass" @click="$emit('filter', stat.key)">
        <q-card-section class="q-pa-sm text-center">
          <div class="text-h5 text-weight-bold" :class="stat.textClass">{{ stat.count }}</div>
          <div class="text-caption" :class="stat.textClass">{{ stat.label }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'RestockSummaryBar' })

const props = defineProps({
  counts: { type: Object, default: () => ({}) },
  permissions: { type: Object, default: () => ({}) }
})

defineEmits(['filter'])

import { useResourceConfig } from '../../../composables/resources/useResourceConfig.js'

const { allowed } = useResourceConfig()
const canCreate = computed(() => allowed('CREATE'))
const canApprove = computed(() => allowed('APPROVE'))

const allStats = [
  { key: 'DRAFT', label: 'Drafts', count: 0, bgClass: 'bg-grey-2', textClass: 'text-grey-8' },
  { key: 'PENDING_APPROVAL', label: 'Pending', count: 0, bgClass: 'bg-orange-1', textClass: 'text-orange-8' },
  { key: 'APPROVED', label: 'Approved', count: 0, bgClass: 'bg-green-1', textClass: 'text-green-8' },
  { key: 'PARTIALLY_DELIVERED', label: 'Partially Delivered', count: 0, bgClass: 'bg-blue-1', textClass: 'text-blue-8' }
]

const visibleStats = computed(() => {
  const counts = props.counts || {}
  let allowedKeys = []
  if (canCreate.value && canApprove.value) {
    allowedKeys = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_DELIVERED']
  } else if (canCreate.value) {
    allowedKeys = ['DRAFT', 'PENDING_APPROVAL']
  } else if (canApprove.value) {
    allowedKeys = ['PENDING_APPROVAL', 'PARTIALLY_DELIVERED']
  } else {
    allowedKeys = ['PENDING_APPROVAL']
  }
  return allStats.map(s => ({ ...s, count: counts[s.key] || 0 })).filter(s => allowedKeys.includes(s.key))
})
</script>

<style scoped>
.summary-stat-card { transition: transform 0.15s ease; }
.summary-stat-card:hover { transform: translateY(-2px); }
</style>
