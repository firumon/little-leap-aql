<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="detail-card">
      <q-card-section class="row items-center">
        <div class="text-subtitle1 text-weight-bold">{{ detailRow?.Code || '' }}</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="$emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />
      <q-card-section class="q-gutter-y-xs">
        <div class="detail-head">{{ resolvePrimaryText(detailRow || {}) }}</div>
        <div v-for="field in detailFields" :key="field.header" class="detail-line">
          <span class="detail-key">{{ field.label }}</span>
          <span class="detail-val">{{ detailRow?.[field.header] || '-' }}</span>
        </div>
      </q-card-section>
      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn
          v-for="report in recordReports"
          :key="report.name"
          flat
          no-caps
          dense
          :icon="report.icon || 'picture_as_pdf'"
          :label="report.label || report.name"
          color="deep-orange-7"
          class="report-action-btn"
          :loading="isGenerating"
          :disable="isGenerating"
          @click="$emit('generate-report', report, detailRow)"
        />
        <q-space />
        <q-btn flat label="Close" @click="$emit('update:modelValue', false)" />
        <q-btn color="primary" icon="edit" label="Edit" @click="$emit('edit')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  detailRow: {
    type: Object,
    default: null
  },
  detailFields: {
    type: Array,
    default: () => []
  },
  resolvePrimaryText: {
    type: Function,
    required: true
  },
  reports: {
    type: Array,
    default: () => []
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:modelValue', 'edit', 'generate-report'])

const recordReports = computed(() => {
  return (props.reports || []).filter((r) => r.isRecordLevel)
})
</script>

<style scoped>
.detail-card {
  min-width: 300px;
  width: 100%;
  max-width: 560px;
  border-radius: 16px;
}

.detail-head {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #0f172a;
}

.detail-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 2px;
  border-bottom: 1px dashed #e2e8f0;
}

.detail-key {
  color: #64748b;
  font-size: 12px;
}

.detail-val {
  color: #1f2937;
  font-size: 12px;
  text-align: right;
}

.report-action-btn {
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
}
</style>
