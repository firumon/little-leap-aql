<template>
  <q-card v-if="hasAnyContent" flat bordered class="action-bar-card q-mt-sm">
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
        <ResourceReports />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, inject } from 'vue'
import ResourceReports from 'components/Reports/ResourceReports.vue'

const props = defineProps({
  permissions: { type: Object, default: null },
  additionalActions: { type: Array, default: () => [] }
})

defineEmits(['edit', 'action-clicked'])

const { config } = inject('resourceConfig')

const visibleActions = computed(() => {
  return props.additionalActions.filter((action) => {
    const perm = props.permissions
    if (!perm) return false
    const actionKey = `can${action.action}`
    return perm[actionKey] !== false
  })
})

const recordReports = computed(() => {
  return (config.value?.reports || []).filter((r) => r.isRecordLevel)
})

const hasAnyContent = computed(() => {
  return !!(props.permissions?.canUpdate) || visibleActions.value.length > 0 || recordReports.value.length > 0
})
</script>

<style scoped>
.action-bar-card {
  border-radius: 16px;
  border-color: var(--aql-border);
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
