<template>
  <q-card flat bordered class="page-card q-mt-sm">
    <q-card-section>
      <div class="section-title">Details</div>
      <div class="detail-grid">
        <div v-for="field in detailFields" :key="field.header" class="detail-line">
          <span class="detail-key">{{ field.label }}</span>
          <span class="detail-val">{{ record?.[field.header] || '-' }}</span>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  record: { type: Object, default: null },
  resolvedFields: { type: Array, default: () => [] },
  additionalActions: { type: Array, default: () => [] }
})

const auditHeaders = new Set(['CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'])

const actionStampHeaders = computed(() => {
  const stamps = new Set()
  props.additionalActions.forEach(action => {
    const raw = action.action || ''
    if (!raw) return
    // Ensure PascalCase: capitalize first letter, preserve rest (handles camelCase input)
    const pascal = raw.charAt(0).toUpperCase() + raw.slice(1)
    stamps.add(`${pascal}By`)
    stamps.add(`${pascal}At`)
  })
  return stamps
})

const detailFields = computed(() => {
  return props.resolvedFields.filter((f) =>
    f.header !== 'Code' &&
    !auditHeaders.has(f.header) &&
    !actionStampHeaders.value.has(f.header)
  )
})
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
.detail-grid { display: grid; gap: 0; }
.detail-line { display: flex; justify-content: space-between; gap: 16px; padding: 10px 2px; border-bottom: 1px dashed #e2e8f0; }
.detail-line:last-child { border-bottom: none; }
.detail-key { color: #64748b; font-size: 13px; }
.detail-val { color: #1f2937; font-size: 13px; text-align: right; font-weight: 500; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
