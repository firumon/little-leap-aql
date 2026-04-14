<template>
  <q-card v-if="record?.CreatedAt || record?.UpdatedAt" flat bordered class="page-card q-mt-sm">
    <q-card-section>
      <div class="section-title">Audit</div>
      <div class="detail-grid">
        <div v-if="record.CreatedAt" class="detail-line">
          <span class="detail-key">Created</span>
          <span class="detail-val">{{ formatDate(record.CreatedAt) }}</span>
        </div>
        <div v-if="record.UpdatedAt" class="detail-line">
          <span class="detail-key">Updated</span>
          <span class="detail-val">{{ formatDate(record.UpdatedAt) }}</span>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  record: { type: Object, default: null }
})

function formatDate(value) {
  if (!value) return '-'
  try {
    const d = new Date(typeof value === 'number' ? value : Number(value) || value)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(value) }
}
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
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
