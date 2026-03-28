<template>
  <q-card flat bordered class="header-card">
    <q-card-section class="q-pa-sm">
      <div class="row items-center no-wrap">
        <div class="col">
          <div class="header-title">{{ config?.ui?.pageTitle || config?.name }}</div>
          <div class="header-subtitle">{{ config?.ui?.pageDescription || 'Manage records' }}</div>
        </div>
        <div class="row items-center q-gutter-xs">
          <q-btn
            v-if="!backgroundSyncing"
            flat
            round
            icon="refresh"
            color="primary"
            size="sm"
            :loading="loading"
            :disable="loading || backgroundSyncing"
            @click="$emit('reload')"
          >
            <q-tooltip>Force Sync from Server</q-tooltip>
          </q-btn>
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
    </q-card-section>

    <!-- Report action bar — only renders when reports exist -->
    <template v-if="toolbarReports.length">
      <q-separator />
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
    </template>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  config: {
    type: Object,
    default: null
  },
  filteredCount: {
    type: Number,
    default: 0
  },
  totalCount: {
    type: Number,
    default: 0
  },
  loading: {
    type: Boolean,
    default: false
  },
  backgroundSyncing: {
    type: Boolean,
    default: false
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

defineEmits(['reload', 'generate-report'])

const toolbarReports = computed(() => {
  return (props.reports || []).filter((r) => !r.isRecordLevel)
})
</script>

<style scoped>
.header-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

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

@keyframes pulse-sync {
  0% { transform: rotate(0deg); opacity: 0.5; }
  50% { opacity: 1; }
  100% { transform: rotate(360deg); opacity: 0.5; }
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
