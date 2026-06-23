<template>
  <q-card flat bordered class="header-card">
    <q-card-section :class="isList ? 'q-pa-sm' : ''">
      <!-- 1. LIST HEADER -->
      <template v-if="isList">
        <div class="row items-center no-wrap">
          <div class="col">
            <div class="header-title">{{ title }}</div>
            <div class="header-subtitle">{{ subtitle || 'Manage records' }}</div>
          </div>
          <div class="row items-center q-gutter-xs">
            <ReloadButton />
            <q-icon
              v-if="backgroundSyncing"
              name="sync"
              color="primary"
              class="sync-indicator q-ml-xs"
            >
              <q-tooltip>Background Synchronizing...</q-tooltip>
            </q-icon>
          </div>
        </div>
        <div class="header-stats row q-col-gutter-sm q-mt-sm">
          <div class="col-6">
            <div class="mini-stat">
              <div class="mini-label">Visible</div>
              <div class="mini-value">{{ filteredCount }}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="mini-stat">
              <div class="mini-label">Total</div>
              <div class="mini-value">{{ totalCount }}</div>
            </div>
          </div>
        </div>
      </template>

      <!-- 2. VIEW HEADER -->
      <template v-else-if="isView">
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
      </template>

      <!-- 3. ACTION / ADD / EDIT HEADER -->
      <template v-else>
        <div class="page-title-simple">
          <q-icon :name="icon" size="24px" :color="iconColor" class="q-mr-sm" />
          {{ simpleTitle }}
        </div>
        <div v-if="actionSubtitle" class="text-grey-7 q-mt-xs">{{ actionSubtitle }}</div>
      </template>
    </q-card-section>

    <q-linear-progress
      v-if="isList && (loading || backgroundSyncing)"
      indeterminate
      color="primary"
      size="2px"
      class="header-progress"
    />
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import ReloadButton from 'src/components/shared/ReloadButton.vue'

const props = defineProps({
  // Global / Shared
  config: { type: Object, default: null },
  record: { type: Object, default: null },
  code: { type: String, default: '' },

  // List Page Props
  filteredCount: { type: Number, default: undefined },
  totalCount: { type: Number, default: undefined },
  loading: { type: Boolean, default: false },
  backgroundSyncing: { type: Boolean, default: false },

  // View Page Props
  resolvedFields: { type: Array, default: () => [] },

  // Action Page Props
  actionConfig: { type: Object, default: null },
  actionName: { type: String, default: '' }
})

defineEmits(['reload'])

// Page Context Detection
const isList = computed(() => props.totalCount !== undefined)
const isView = computed(() => !isList.value && !!props.record && !props.actionName && !props.actionConfig)
const isAction = computed(() => !isList.value && !!props.record && (!!props.actionName || !!props.actionConfig))
const isEdit = computed(() => !isList.value && !props.record && !!props.code)
const isAdd = computed(() => !isList.value && !props.record && !props.code)

// List Computeds
const title = computed(() => props.config?.ui?.menus?.[0]?.pageTitle || props.config?.name || 'Records')
const subtitle = computed(() => props.config?.ui?.menus?.[0]?.pageDescription)

// View Computeds
const primaryText = computed(() => {
  const row = props.record
  if (!row) return '-'
  if (row.Name) return row.Name
  const firstFilled = props.resolvedFields.find((f) => {
    const v = row[f.header]
    return v && v.toString().trim() && f.header !== 'Status'
  })
  return firstFilled ? row[firstFilled.header] : '-'
})

// Action / Add / Edit Computeds
const icon = computed(() => {
  if (isAction.value) return props.actionConfig?.icon || 'play_arrow'
  if (isEdit.value) return 'edit'
  return 'add_circle_outline'
})

const iconColor = computed(() => {
  if (isAction.value) return props.actionConfig?.color || 'primary'
  return 'primary'
})

const simpleTitle = computed(() => {
  if (isAction.value) {
    return `${props.actionConfig?.label || props.actionName} — ${props.record?.Code || ''}`
  }
  const entityTitle = props.config?.ui?.menus?.[0]?.pageTitle || props.config?.name || 'Record'
  if (isEdit.value) {
    return `Edit ${entityTitle} — ${props.code}`
  }
  return `Create ${entityTitle}`
})

const actionSubtitle = computed(() => {
  if (!isAction.value || !props.record) return ''
  return props.record.Name || ''
})
</script>

<style scoped>
.header-card {
  border-radius: 16px;
  border-color: var(--aql-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}

/* List Styles */
.header-title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 700;
}
.header-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}
.mini-stat {
  border: 1px solid #e6edf5;
  border-radius: 10px;
  padding: 6px 10px;
  background: #fff;
}
.mini-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.mini-value {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}
.sync-indicator {
  animation: pulse-sync 2s infinite linear;
  opacity: 0.8;
}

/* View Styles */
.record-code-label { font-size: 12px; color: var(--master-soft-ink); letter-spacing: 0.04em; font-weight: 500; }
.record-title { font-size: 22px; font-weight: 800; color: var(--aql-ink); margin-top: 2px; }
.status-badge { border-radius: 8px; font-weight: 600; padding: 4px 12px; font-size: 12px; }

/* Action / Add / Edit Styles */
.page-title-simple { font-size: 18px; font-weight: 700; color: var(--aql-ink); display: flex; align-items: center; }

@keyframes pulse-sync {
  0% { transform: rotate(0deg); opacity: 0.5; }
  50% { opacity: 1; }
  100% { transform: rotate(360deg); opacity: 0.5; }
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
