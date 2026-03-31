<template>
  <q-card flat bordered class="action-bar-card q-mt-sm">
    <q-card-section class="action-bar q-pa-sm">
      <div class="row items-center q-gutter-xs">
        <q-btn
          v-if="permissions?.canUpdate"
          unelevated no-caps dense
          icon="edit" label="Edit" color="primary"
          class="action-btn"
          @click="$emit('edit')"
        />
        <q-btn
          v-for="action in visibleActions"
          :key="action.action"
          outline no-caps dense
          :icon="action.icon || 'play_arrow'"
          :label="action.label"
          :color="action.color || 'primary'"
          class="action-btn"
          @click="$emit('action-clicked', action)"
        />
        <q-space />
        <q-btn
          v-for="report in recordReports"
          :key="report.name"
          unelevated no-caps dense
          :icon="report.icon || 'picture_as_pdf'"
          :label="report.label || report.name"
          color="deep-orange-7"
          class="action-btn"
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
  permissions: { type: Object, default: null },
  additionalActions: { type: Array, default: () => [] },
  reports: { type: Array, default: () => [] },
  isGenerating: { type: Boolean, default: false }
})

defineEmits(['edit', 'action-clicked', 'generate-report'])

const visibleActions = computed(() => {
  return props.additionalActions.filter((action) => {
    const perm = props.permissions
    if (!perm) return false
    const actionKey = `can${action.action}`
    return perm[actionKey] !== false
  })
})

const recordReports = computed(() => {
  return (props.reports || []).filter((r) => r.isRecordLevel)
})
</script>

<style scoped>
.action-bar-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.action-bar { background: #f8fafc; }
.action-btn { border-radius: 10px; font-weight: 600; font-size: 12px; letter-spacing: 0.02em; padding: 4px 14px; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
