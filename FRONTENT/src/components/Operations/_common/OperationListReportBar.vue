<template>
  <q-card v-if="toolbarReports.length" flat bordered class="report-bar-card q-mt-sm">
    <q-card-section class="action-bar q-pa-sm">
      <div class="row items-center q-gutter-xs">
        <q-btn
          v-for="report in toolbarReports"
          :key="report.name"
          unelevated
          no-caps
          dense
          :icon="report.icon || 'picture_as_pdf'"
          :label="report.label || report.name"
          color="deep-orange-7"
          class="report-btn"
          :loading="isGenerating"
          :disable="isGenerating"
          @click="$emit('generate-report', report)"
        >
          <q-tooltip>{{ report.label || report.name }}</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  reports: {
    type: Array,
    default: () => []
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

defineEmits(['generate-report'])

const toolbarReports = computed(() => {
  return (props.reports || []).filter((report) => report.isRecordLevel !== true)
})
</script>

<style scoped>
.report-bar-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

.action-bar {
  background: #f8fafc;
}

.report-btn {
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 4px 14px;
}

@keyframes rise-in {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
