<template>
  <q-card flat bordered class="header-card">
    <q-card-section class="q-pa-sm">
      <div class="row items-center no-wrap">
        <div class="col">
          <div class="header-title">{{ config?.ui?.pageTitle || config?.name }}</div>
          <div class="header-subtitle">{{ config?.ui?.pageDescription || 'Manage records' }}</div>
        </div>
        <div class="row items-center">
          <q-btn
            v-if="!backgroundSyncing"
            flat
            round
            icon="refresh"
            color="primary"
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
  </q-card>
</template>

<script setup>
defineProps({
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
  }
})

defineEmits(['reload'])
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
