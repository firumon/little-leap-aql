<template>
  <q-card flat class="record-card" @click="$emit('open-detail', row.Code || row.id || row)">
    <q-card-section class="q-pa-sm">
      <div class="row items-center justify-between no-wrap q-col-gutter-sm">
        <div class="row items-center col no-wrap">
          <q-avatar v-if="resolvedIcon" :icon="resolvedIcon" color="primary" text-color="white" size="32px" class="q-mr-sm" />
          <div class="col overflow-hidden">
            <div v-if="activeConfig.codeVisible !== false && row.Code" class="record-code">{{ row.Code }}</div>
            <div class="record-name ellipsis">{{ resolvedPrimary }}</div>
            <div v-if="resolvedSecondary" class="record-secondary ellipsis">{{ resolvedSecondary }}</div>
          </div>
        </div>
        <div v-if="resolvedChip" class="col-auto">
          <q-badge :color="resolvedChipColor" :text-color="resolvedChipTextColor" :label="resolvedChip" />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  row: {
    type: Object,
    required: true
  },
  resolvePrimaryText: {
    type: Function,
    required: true
  },
  resolveSecondaryText: {
    type: Function,
    required: true
  },
  recordConfig: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['open-detail'])

const activeConfig = computed(() => {
  return {
    primary: null,
    secondary: null,
    codeVisible: true,
    chip: 'Status',
    chipColor: (val) => val === 'Active' ? 'positive' : 'grey',
    chipTextColor: 'white',
    icon: null,
    ...(props.recordConfig || {})
  }
})

function evaluate(val, row) {
  if (typeof val === 'function') {
    return val(row)
  }
  return val
}

const resolvedPrimary = computed(() => {
  if (activeConfig.value.primary) {
    const val = evaluate(activeConfig.value.primary, props.row)
    if (val !== undefined && val !== null) return val
  }
  return props.resolvePrimaryText(props.row)
})

const resolvedSecondary = computed(() => {
  if (activeConfig.value.secondary) {
    const val = evaluate(activeConfig.value.secondary, props.row)
    if (val !== undefined && val !== null) return val
  }
  return props.resolveSecondaryText(props.row)
})

const resolvedIcon = computed(() => {
  if (!activeConfig.value.icon) return null
  return evaluate(activeConfig.value.icon, props.row)
})

const resolvedChip = computed(() => {
  if (!activeConfig.value.chip) return null
  if (activeConfig.value.chip === 'Status' && !props.row.Status) return null
  const chipField = activeConfig.value.chip
  if (typeof chipField === 'function') {
    return chipField(props.row)
  }
  return props.row[chipField] || null
})

const resolvedChipColor = computed(() => {
  const colorVal = activeConfig.value.chipColor
  if (typeof colorVal === 'function') {
    const statusVal = props.row[activeConfig.value.chip] || props.row.Status
    return colorVal(statusVal, props.row)
  }
  return colorVal
})

const resolvedChipTextColor = computed(() => {
  const colorVal = activeConfig.value.chipTextColor
  if (typeof colorVal === 'function') {
    const statusVal = props.row[activeConfig.value.chip] || props.row.Status
    return colorVal(statusVal, props.row)
  }
  return colorVal
})
</script>

<style scoped>
.record-card {
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid #d9e4f0;
  background: linear-gradient(175deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 6px 16px rgba(23, 37, 61, 0.08);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.record-card:active {
  transform: scale(0.995);
}

.record-card:hover {
  box-shadow: 0 10px 24px rgba(23, 37, 61, 0.12);
}

.record-code {
  font-size: 12px;
  color: var(--master-soft-ink);
  letter-spacing: 0.03em;
}

.record-name {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 700;
  color: var(--aql-ink);
}

.record-secondary {
  margin-top: 3px;
  font-size: 12px;
  color: #64748b;
}
</style>
