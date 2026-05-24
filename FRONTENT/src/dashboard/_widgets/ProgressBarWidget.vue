<template>
  <q-card class="dashboard-widget-card progress-bar-widget overflow-hidden relative-position" :class="`theme-${themeColor}`">
    <div class="glow-effect"></div>
    <q-card-section class="q-pa-lg full-height column justify-between">
      <!-- Loading Skeleton State -->
      <div v-if="loading" class="q-gutter-sm">
        <q-skeleton type="text" width="60%" class="bg-white opacity-20" />
        <q-skeleton type="rect" height="24px" class="q-my-md bg-white opacity-10" />
        <div class="row justify-between q-mt-sm">
          <q-skeleton type="text" width="20%" class="bg-white opacity-20" />
          <q-skeleton type="text" width="20%" class="bg-white opacity-20" />
          <q-skeleton type="text" width="20%" class="bg-white opacity-20" />
        </div>
      </div>

      <!-- Real Content State -->
      <div v-else class="column justify-between full-height">
        <!-- Header -->
        <div class="row items-center justify-between no-wrap q-mb-md">
          <div class="column">
            <span class="widget-title text-subtitle2 text-weight-medium text-grey-3 ellipsis">
              {{ widgetConfig.metadata.config.title }}
            </span>
          </div>
          <q-avatar 
            size="42px" 
            class="widget-icon-container text-white" 
            :icon="widgetConfig.metadata.config.icon || 'bar_chart'" 
          />
        </div>

        <!-- Progress Bar and Details -->
        <div class="column justify-end q-mt-auto">
          <!-- Total Summary Header -->
          <div class="row items-baseline justify-between q-mb-xs">
            <span class="text-caption text-grey-4">Visit Execution</span>
            <span class="text-weight-bold text-white text-subtitle1">
              {{ totalCount }} <span class="text-caption text-grey-4 text-weight-normal">Planned</span>
            </span>
          </div>

          <!-- Multi-Segment Progress Track -->
          <div class="progress-track row overflow-hidden q-mb-md">
            <div 
              v-for="segment in activeSegments" 
              :key="segment.key"
              class="progress-segment relative-position cursor-pointer"
              :style="{ 
                width: `${segment.percent}%`,
                background: segment.gradient || segment.color 
              }"
            >
              <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 8]" class="tooltip-style">
                <div class="text-weight-bold text-capitalize">{{ segment.label }}</div>
                <div>{{ segment.value }} / {{ totalCount }} visits ({{ segment.percent }}%)</div>
              </q-tooltip>
            </div>
            
            <!-- Empty base state if 0 total -->
            <div 
              v-if="totalCount === 0" 
              class="progress-segment-empty full-width full-height bg-white opacity-10 text-center text-caption text-grey-5 flex items-center justify-center"
            >
              No visits planned
            </div>
          </div>

          <!-- Interactive Legend Row -->
          <div class="row items-center justify-between q-col-gutter-xs">
            <div 
              v-for="segment in displaySegments" 
              :key="segment.key"
              class="col-4 col-sm-auto row items-center no-wrap legend-item"
            >
              <span class="legend-dot q-mr-xs" :style="{ background: segment.dotColor }"></span>
              <div class="column">
                <span class="legend-label text-grey-4 ellipsis">{{ segment.label }}</span>
                <span class="legend-value text-weight-bold text-white text-caption">
                  {{ segment.value }} <span class="text-grey-5 font-normal text-xxs">({{ segment.percent }}%)</span>
                </span>
              </div>
            </div>
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
    type: Object,
    default: () => null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// Configuration Extraction
const config = computed(() => props.widgetConfig.metadata.config || {})
const themeColor = computed(() => config.value.color || 'primary')
const segmentsConfig = computed(() => config.value.chart?.segments || [])

// Value Calculation
const totalCount = computed(() => props.widgetValue?.total ?? 0)

// Helper to determine active segments with calculated percentages
const activeSegments = computed(() => {
  if (totalCount.value === 0) return []

  return segmentsConfig.value.map((seg) => {
    const rawVal = props.widgetValue?.[seg.key] ?? 0
    const percent = Number(((rawVal / totalCount.value) * 100).toFixed(1))
    
    return {
      key: seg.key,
      label: seg.label || seg.key,
      value: rawVal,
      percent,
      color: seg.color || 'grey',
      gradient: seg.gradientStart && seg.gradientEnd 
        ? `linear-gradient(90deg, ${seg.gradientStart}, ${seg.gradientEnd})` 
        : null
    }
  }).filter(seg => seg.value > 0) // Only render segments that have positive values
})

// Legend segments including 0 value segments to keep UI balanced
const displaySegments = computed(() => {
  return segmentsConfig.value.map((seg) => {
    const rawVal = props.widgetValue?.[seg.key] ?? 0
    const percent = totalCount.value > 0 
      ? Number(((rawVal / totalCount.value) * 100).toFixed(0)) 
      : 0
    
    return {
      key: seg.key,
      label: seg.label || seg.key,
      value: rawVal,
      percent,
      dotColor: seg.gradientStart || seg.color || 'grey'
    }
  })
})
</script>

<style lang="scss" scoped>
.dashboard-widget-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  min-height: 180px;
  height: auto;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.15);

    .widget-icon-container {
      transform: scale(1.05) rotate(5deg);
    }
    .glow-effect {
      opacity: 0.2;
    }
  }
}

.glow-effect {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.1;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.widget-icon-container {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(4px);
  transition: transform 0.3s ease;
}

.progress-track {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  height: 18px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.progress-segment {
  height: 100%;
  transition: width 1s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  &:not(:last-child) {
    border-right: 1px solid rgba(0, 0, 0, 0.15);
  }
  
  &:hover {
    filter: brightness(1.15);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }
}

.progress-segment-empty {
  font-size: 0.7rem;
  line-height: 1;
}

.legend-item {
  font-size: 0.725rem;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.legend-label {
  font-size: 0.675rem;
  line-height: 1.1;
}

.legend-value {
  font-size: 0.75rem;
  line-height: 1.1;
}

.font-normal {
  font-weight: normal;
}

.text-xxs {
  font-size: 0.6rem;
}

.tooltip-style {
  background: rgba(20, 20, 25, 0.95) !important;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* Premium HSL Theme Styling */
.theme-primary {
  background: linear-gradient(135deg, hsl(220, 60%, 25%) 0%, hsl(220, 50%, 15%) 100%);
  .glow-effect { background: hsl(220, 100%, 65%); }
}
.theme-orange {
  background: linear-gradient(135deg, hsl(25, 75%, 28%) 0%, hsl(25, 70%, 15%) 100%);
  .glow-effect { background: hsl(25, 100%, 60%); }
}
.theme-blue {
  background: linear-gradient(135deg, hsl(200, 75%, 25%) 0%, hsl(200, 70%, 15%) 100%);
  .glow-effect { background: hsl(200, 100%, 60%); }
}
.theme-purple {
  background: linear-gradient(135deg, hsl(275, 60%, 28%) 0%, hsl(275, 50%, 15%) 100%);
  .glow-effect { background: hsl(275, 100%, 65%); }
}
.theme-teal {
  background: linear-gradient(135deg, hsl(170, 70%, 22%) 0%, hsl(170, 60%, 12%) 100%);
  .glow-effect { background: hsl(170, 100%, 55%); }
}
.theme-green {
  background: linear-gradient(135deg, hsl(140, 60%, 22%) 0%, hsl(140, 50%, 12%) 100%);
  .glow-effect { background: hsl(140, 100%, 50%); }
}
</style>
