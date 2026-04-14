<template>
  <q-card flat bordered class="page-card">
    <q-card-section>
      <div class="page-title">
        <q-icon
          :name="actionConfig?.icon || 'play_arrow'"
          size="24px"
          :color="actionConfig?.color || 'primary'"
          class="q-mr-sm"
        />
        {{ actionConfig?.label || actionName }} — {{ record?.Code }}
      </div>
      <div class="text-grey-7 q-mt-xs">{{ primaryText }}</div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  actionConfig: { type: Object, default: null },
  actionName: { type: String, default: '' },
  record: { type: Object, default: null }
})

const primaryText = computed(() => {
  const row = props.record
  if (!row) return '-'
  if (row.Name) return row.Name
  return '-'
})
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.page-title { font-size: 18px; font-weight: 700; color: var(--operation-ink, #0f172a); display: flex; align-items: center; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
