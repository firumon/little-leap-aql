<template>
  <div v-if="hasAudit">
    <SectionDividerLabel label="Audit" />
    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div class="aql-detail-grid">
          <div v-if="record?.CreatedAt" class="aql-detail-line">
            <span class="aql-detail-key">Created</span>
            <span class="aql-detail-val">{{ formatDate(record.CreatedAt) }}</span>
          </div>
          <div v-if="record?.UpdatedAt" class="aql-detail-line">
            <span class="aql-detail-key">Updated</span>
            <span class="aql-detail-val">{{ formatDate(record.UpdatedAt) }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'ContentsViewAudit', inheritAttrs: false })

const { record } = inject('resourceRecord')

const hasAudit = computed(() => !!(record.value?.CreatedAt || record.value?.UpdatedAt))

function formatDate(value) {
  if (!value) return '-'
  try {
    const d = new Date(typeof value === 'number' ? value : Number(value) || value)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(value)
  }
}
</script>
