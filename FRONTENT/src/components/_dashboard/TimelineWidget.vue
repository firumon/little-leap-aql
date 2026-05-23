<template>
  <q-card class="dashboard-widget-card timeline-widget overflow-hidden relative-position">
    <q-card-section class="q-pa-md">
      <div class="row items-center justify-between no-wrap q-mb-md">
        <div class="row items-center q-gutter-sm">
          <q-icon :name="widgetConfig.metadata.config.icon || 'receipt_long'" size="24px" :class="`text-${themeColor}`" />
          <span class="text-subtitle1 text-weight-medium text-grey-9 ellipsis">{{ widgetConfig.metadata.config.title }}</span>
        </div>
        <q-badge :color="themeColor" outline>Timeline</q-badge>
      </div>

      <div v-if="loading" class="q-pa-md q-gutter-md">
        <div v-for="i in 3" :key="i" class="row no-wrap items-start">
          <q-skeleton type="circle" size="24px" class="opacity-40 q-mr-md" />
          <div class="column col q-gutter-xs">
            <q-skeleton type="text" width="60%" />
            <q-skeleton type="text" width="40%" />
          </div>
        </div>
      </div>

      <div v-else-if="timelineData.length === 0" class="column items-center justify-center text-grey-5" style="height: 240px;">
        <q-icon name="assignment_turned_in" size="3rem" class="q-mb-sm text-grey-4" />
        <div class="text-subtitle2">No recent events tracked</div>
      </div>

      <div v-else class="timeline-container scroll-container overflow-auto q-pr-sm" style="max-height: 250px;">
        <div v-for="(item, idx) in timelineData" :key="idx" class="timeline-item row no-wrap relative-position q-pb-md">
          <!-- Left line -->
          <div v-if="idx < timelineData.length - 1" class="timeline-line"></div>

          <!-- Dot / Icon -->
          <div class="timeline-dot-wrapper flex flex-center">
            <div class="timeline-dot" :class="`bg-${getStatusColor(item.status)}`">
              <q-icon name="check" size="10px" class="text-white" />
            </div>
          </div>

          <!-- Content -->
          <div class="timeline-content column col q-pl-md">
            <div class="row items-center justify-between no-wrap">
              <span class="text-subtitle2 text-weight-medium text-grey-9 ellipsis item-title">
                {{ item.title }}
              </span>
              <q-badge :color="getStatusColor(item.status)" class="status-badge shrink-0" size="xs">
                {{ item.status || 'Active' }}
              </q-badge>
            </div>
            <span class="text-caption text-grey-6 ellipsis-2-lines q-mt-xs">
              {{ item.subtitle }}
            </span>
            <span class="text-caption text-grey-4 q-mt-xs row items-center q-gutter-xs">
              <q-icon name="schedule" size="12px" />
              <span>{{ formatTime(item.timestamp) }}</span>
            </span>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  widgetConfig: {
    type: Object,
    required: true
  },
  widgetValue: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const themeColor = computed(() => props.widgetConfig.metadata.config.color || 'primary')

const timelineData = computed(() => {
  if (!Array.isArray(props.widgetValue)) return []
  return props.widgetValue
})

const getStatusColor = (status) => {
  const clean = String(status || '').toLowerCase().trim()
  if (clean.includes('pending') || clean.includes('awaiting') || clean.includes('draft')) return 'orange'
  if (clean.includes('approve') || clean.includes('active') || clean.includes('success') || clean.includes('paid')) return 'green'
  if (clean.includes('cancel') || clean.includes('reject') || clean.includes('close')) return 'red'
  return 'primary'
}

const formatTime = (ts) => {
  if (!ts) return 'Just now'
  
  // Format string or Date object cleanly
  try {
    const date = new Date(ts)
    if (isNaN(date.getTime())) return String(ts)
    
    // Check if it is today
    const today = new Date()
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear()
                    
    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(ts)
  }
}
</script>

<style lang="scss" scoped>
.dashboard-widget-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  height: 350px;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 30px 0 rgba(0, 0, 0, 0.12);
  }
}

.timeline-container {
  height: 250px;
}

.timeline-item {
  width: 100%;
}

.timeline-line {
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: 0;
  width: 2px;
  background: #e2e8f0;
}

.timeline-dot-wrapper {
  width: 24px;
  height: 24px;
  z-index: 2;
}

.timeline-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-title {
  max-width: 150px;
}

.status-badge {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 4px;
}

.scroll-container::-webkit-scrollbar {
  width: 4px;
}
.scroll-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
</style>
