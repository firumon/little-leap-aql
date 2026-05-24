<template>
  <q-card class="dashboard-widget-card stacked-bar-chart-widget overflow-hidden relative-position">
    <q-card-section class="q-pa-md">
      <div class="widget-header-container q-mb-md">
        <div class="widget-title-area">
          <q-icon :name="widgetConfig.metadata.config.icon || 'bar_chart'" size="24px" :class="`text-${themeColor} widget-icon`" />
          <span class="text-subtitle1 text-weight-medium text-grey-9 widget-title">{{ widgetConfig.metadata.config.title }}</span>
        </div>
        
        <!-- Dynamic Legend from Config -->
        <div class="widget-legend-area">
          <div v-for="s in chartConfig.series" :key="s.key" class="row items-center q-gutter-xs legend-item">
            <span class="legend-dot" :style="{ backgroundColor: s.gradientStart }"></span>
            <span class="text-caption text-grey-7 text-weight-medium">{{ s.label }}</span>
          </div>
        </div>
      </div>

      <!-- Pulse Skeleton Loader -->
      <div v-if="loading" class="q-pa-md">
        <div class="row items-end justify-between q-gutter-sm" style="height: 200px;">
          <q-skeleton v-for="i in 7" :key="i" class="col bg-grey-3" height="40%" style="border-radius: 4px 4px 0 0;" />
        </div>
        <div class="row justify-between q-mt-sm">
          <q-skeleton v-for="i in 7" :key="i" type="text" width="10%" />
        </div>
      </div>

      <!-- Dynamic Empty State -->
      <div v-else-if="chartData.length === 0" class="column items-center justify-center text-grey-5" style="height: 240px;">
        <q-icon name="trending_flat" size="3rem" class="q-mb-sm text-grey-4" />
        <div class="text-subtitle2">{{ chartConfig.emptyMessage }}</div>
      </div>

      <!-- Pure SVG Dynamic Stack Chart -->
      <div v-else class="chart-container relative-position">
        <svg viewBox="0 0 500 280" class="full-width svg-chart">
          <!-- Dynamic defs for gradients and dropshadows scoped to widget instances -->
          <defs>
            <linearGradient
              v-for="s in chartConfig.series"
              :key="`grad-${s.key}`"
              :id="`grad-${widgetConfig.metadata.id}-${s.key}`"
              x1="0" y1="0" x2="0" y2="1"
            >
              <stop offset="0%" :stop-color="s.gradientStart" stop-opacity="1" />
              <stop offset="100%" :stop-color="s.gradientEnd" stop-opacity="0.8" />
            </linearGradient>
            <filter
              v-for="s in chartConfig.series"
              :key="`shadow-${s.key}`"
              :id="`shadow-${widgetConfig.metadata.id}-${s.key}`"
              x="-10%" y="-10%" width="120%" height="120%"
            >
              <feDropShadow dx="0" dy="2" stdDeviation="2" :flood-color="s.shadowColor || s.gradientStart" flood-opacity="0.15" />
            </filter>
          </defs>

          <!-- Horizontal Grid Lines -->
          <g class="grid-lines">
            <line
              v-for="tick in yTicks"
              :key="tick"
              x1="50"
              :y1="getY(tick)"
              x2="480"
              :y2="getY(tick)"
              stroke="#e2e8f0"
              stroke-width="1"
              stroke-dasharray="3 3"
            />
            <text
              v-for="tick in yTicks"
              :key="`lbl-${tick}`"
              x="42"
              :y="getY(tick) + 4"
              text-anchor="end"
              class="axis-text"
            >
              {{ formatYLabel(tick) }}
            </text>
          </g>

          <!-- Columns / Rects mapping dynamically -->
          <g class="chart-bars">
            <g v-for="(item, idx) in chartData" :key="item.date || idx" class="bar-group">
              <!-- Loop through computed segments for stack rendering -->
              <template v-for="seg in getSegmentsForDay(item)" :key="seg.seriesKey">
                <rect
                  v-if="seg.height > 0"
                  :x="getX(idx)"
                  :y="seg.y"
                  :width="barWidth"
                  :height="seg.height"
                  :fill="`url(#${seg.gradientId})`"
                  rx="3"
                  ry="3"
                  :filter="`url(#${seg.filterId})`"
                  class="chart-rect"
                />
              </template>

              <!-- Interactive Floating Tooltip Trigger -->
              <rect
                :x="getX(idx) - 5"
                :y="10"
                :width="barWidth + 10"
                :height="210"
                fill="transparent"
                class="hover-trigger"
              >
                <q-tooltip class="bg-grey-9 text-caption rounded-borders q-pa-sm" anchor="top middle" self="bottom middle">
                  <div class="text-weight-bold text-white q-mb-xs">{{ item.date || item.label }}</div>
                  <div
                    v-for="s in chartConfig.series"
                    :key="s.key"
                    class="row items-center q-gutter-xs q-mb-xs"
                    :style="{ color: s.gradientStart }"
                  >
                    <q-badge :style="{ backgroundColor: s.gradientStart }" rounded />
                    <span>{{ s.label }}: <strong>{{ item[s.key] || 0 }}</strong></span>
                  </div>
                  <div class="text-weight-bold text-primary q-mt-xs border-top q-pt-xs">
                    Total: {{ getTotalForDay(item) }}
                  </div>
                </q-tooltip>
              </rect>

              <!-- X-Axis label -->
              <text
                :x="getX(idx) + barWidth / 2"
                y="245"
                text-anchor="middle"
                class="axis-text category-label"
              >
                {{ item.label }}
              </text>
            </g>
          </g>

          <!-- Axes -->
          <line x1="50" y1="220" x2="480" y2="220" stroke="#cbd5e1" stroke-width="1.5" />
          <line x1="50" y1="20" x2="50" y2="220" stroke="#cbd5e1" stroke-width="1" />
        </svg>
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

const chartConfig = computed(() => {
  const custom = props.widgetConfig.metadata.config.chart || {}
  return {
    series: custom.series || [
      {
        key: 'completed',
        label: 'Completed',
        gradientStart: 'hsl(142, 70%, 45%)',
        gradientEnd: 'hsl(142, 60%, 35%)',
        shadowColor: 'hsl(142, 70%, 45%)'
      },
      {
        key: 'postponed',
        label: 'Postponed',
        gradientStart: 'hsl(215, 16%, 65%)',
        gradientEnd: 'hsl(215, 12%, 50%)',
        shadowColor: 'hsl(215, 16%, 65%)'
      }
    ],
    emptyMessage: custom.emptyMessage || 'No transaction data available'
  }
})

const chartData = computed(() => {
  if (!Array.isArray(props.widgetValue)) return []
  return props.widgetValue
})

// Math parameters
const maxVal = computed(() => {
  if (!chartData.value.length) return 10
  const max = Math.max(...chartData.value.map(d => {
    return chartConfig.value.series.reduce((sum, s) => sum + Number(d[s.key] || 0), 0)
  }), 0)
  return max === 0 ? 10 : max
})

const yTicks = computed(() => {
  const ticks = []
  const step = maxVal.value / 4
  for (let i = 0; i <= 4; i++) {
    ticks.push(step * i)
  }
  return ticks
})

const barWidth = computed(() => {
  const count = chartData.value.length || 1
  return Math.min(45, 300 / count)
})

const getX = (index) => {
  const count = chartData.value.length || 1
  const spacing = 400 / count
  return 70 + spacing * index
}

const getY = (val) => {
  const heightRatio = val / maxVal.value
  return 220 - (200 * heightRatio)
}

const getCompletedHeight = (val) => {
  return 200 * (Number(val || 0) / maxVal.value)
}

const getPostponedHeight = (val) => {
  return 200 * (Number(val || 0) / maxVal.value)
}

const formatYLabel = (val) => {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`
  return val.toFixed(0)
}

const getTotalForDay = (item) => {
  return chartConfig.value.series.reduce((sum, s) => sum + Number(item[s.key] || 0), 0)
}

// Compute N vertical stack segment parameters dynamically from bottom up
const getSegmentsForDay = (item) => {
  let runningY = 220 // Baseline start
  return chartConfig.value.series.map((s) => {
    const val = Number(item[s.key] || 0)
    const height = maxVal.value > 0 ? (200 * val / maxVal.value) : 0
    runningY -= height
    return {
      seriesKey: s.key,
      height,
      y: runningY,
      gradientId: `grad-${props.widgetConfig.metadata.id}-${s.key}`,
      filterId: `shadow-${props.widgetConfig.metadata.id}-${s.key}`
    }
  })
}
</script>

<style lang="scss" scoped>
.widget-header-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  @media (max-width: 599px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}

.widget-title-area {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.widget-icon {
  flex-shrink: 0;
}

.widget-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 599px) {
    white-space: normal;
    font-size: 15px;
    line-height: 1.3;
    font-weight: 600;
  }
}

.widget-legend-area {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;

  @media (max-width: 599px) {
    width: 100%;
    justify-content: flex-start;
    gap: 16px;
    margin-top: 2px;
  }
}

.dashboard-widget-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  height: 350px;

  @media (max-width: 599px) {
    height: auto;
    
    .q-card__section {
      padding: 12px !important;
    }
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 30px 0 rgba(0, 0, 0, 0.12);
  }
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.chart-container {
  width: 100%;
  height: auto;
  aspect-ratio: 500 / 280; /* Perfectly matches SVG viewBox aspect ratio to eliminate vertical gaps */
}

.axis-text {
  font-size: 10px;
  fill: #64748b;
  font-family: inherit;
}

.category-label {
  font-weight: 500;
}

.chart-rect {
  transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1), y 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }
}

.hover-trigger {
  cursor: pointer;
}
</style>
