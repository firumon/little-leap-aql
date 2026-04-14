<template>
  <q-card flat bordered class="page-card">
    <q-card-section>
      <div class="row items-center no-wrap">
        <div class="col">
          <div class="record-code-label">{{ record?.Code }}</div>
          <div class="record-title">{{ primaryText }}</div>
        </div>
        <q-badge
          :color="record?.Status === 'Active' ? 'positive' : 'grey-6'"
          class="status-badge"
        >
          {{ record?.Status || 'Unknown' }}
        </q-badge>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  record: { type: Object, default: null },
  resolvedFields: { type: Array, default: () => [] }
})

const primaryText = computed(() => {
  const row = props.record
  if (!row) return '-'
  if (row.Name) return row.Name
  const firstFilled = props.resolvedFields?.find((f) => {
    const v = row[f.header]
    return v && v.toString().trim() && f.header !== 'Status'
  })
  return firstFilled ? row[firstFilled.header] : '-'
})
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.record-code-label { font-size: 12px; color: var(--operation-soft-ink, #475569); letter-spacing: 0.04em; font-weight: 500; }
.record-title { font-size: 22px; font-weight: 800; color: var(--operation-ink, #0f172a); margin-top: 2px; }
.status-badge { border-radius: 8px; font-weight: 600; padding: 4px 12px; font-size: 12px; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
