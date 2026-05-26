<template>
  <q-card class="dashboard-widget-card bar-chart-widget overflow-hidden relative-position">
    <q-card-section class="q-pa-md">
      <div class="row items-center justify-between no-wrap q-mb-md">
        <q-item class="q-pa-none q-item-no-link no-wrap col" style="min-height: auto;">
          <q-item-section avatar class="q-pr-sm min-width-auto" style="min-width: auto;">
            <q-icon :name="widgetConfig.metadata.config.icon || 'bar_chart'" size="24px" :class="`text-${themeColor}`" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-subtitle1 text-weight-medium text-grey-9 ellipsis">
              {{ widgetConfig.metadata.config.title }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-badge v-if="widgetConfig.metadata.config.badge" :color="themeColor" outline class="q-ml-sm shrink-0">
          {{ widgetConfig.metadata.config.badge }}
        </q-badge>
      </div>

      <div v-if="loading" class="q-pa-md">
        <div class="row items-end justify-between q-gutter-sm" style="height: 200px;">
          <q-skeleton v-for="i in 5" :key="i" class="col bg-grey-3" height="40%" style="border-radius: 4px 4px 0 0;" />
        </div>
        <div class="row justify-between q-mt-sm">
          <q-skeleton v-for="i in 5" :key="i" type="text" width="12%" />
        </div>
      </div>

      <div v-else-if="chartData.length === 0" class="column items-center justify-center text-grey-5" style="height: 240px;">
        <q-icon name="trending_flat" size="3rem" class="q-mb-sm text-grey-4" />
        <div class="text-subtitle2">{{ widgetConfig.metadata.config.chart?.emptyMessage || 'No transaction data available' }}</div>
      </div>

      <div v-else class="chart-container relative-position">
        <svg viewBox="0 0 500 280" class="full-width svg-chart">
          <!-- Gradients definition -->
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="primaryColor" stop-opacity="1" />
              <stop offset="100%" :stop-color="secondaryColor" stop-opacity="0.3" />
            </linearGradient>
            <filter id="barShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" :flood-color="primaryColor" flood-opacity="0.25" />
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
            <!-- Y-Axis labels -->
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

          <!-- Columns / Rects -->
          <g class="chart-bars">
            <g v-for="(item, idx) in chartData" :key="item.label" class="bar-group">
              <!-- Active rect -->
              <rect
                :x="getX(idx)"
                :y="getY(item.value)"
                :width="barWidth"
                :height="getHeight(item.value)"
                fill="url(#barGradient)"
                rx="6"
                ry="6"
                filter="url(#barShadow)"
                class="chart-rect"
              />
              <!-- Hover Overlay for details -->
              <rect
                :x="getX(idx) - 5"
                :y="10"
                :width="barWidth + 10"
                :height="210"
                fill="transparent"
                class="hover-trigger"
              >
                <q-tooltip class="bg-grey-9 text-caption rounded-borders q-pa-sm">
                  <div class="text-weight-bold">{{ item.label }}</div>
                  <div class="text-primary text-subtitle2">{{ formatTooltip(item.value) }}</div>
                </q-tooltip>
              </rect>
              <!-- X-Axis label -->
              <text
                :x="getX(idx) + barWidth / 2"
                y="245"
                text-anchor="middle"
                class="axis-text category-label"
              >
                {{ truncateLabel(item.label) }}
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

// Primary and Secondary HSL Mapping
const primaryColor = computed(() => {
  const colors = {
    primary: 'hsl(220, 90%, 55%)',
    orange: 'hsl(25, 95%, 50%)',
    blue: 'hsl(200, 95%, 50%)',
    purple: 'hsl(275, 90%, 55%)',
    teal: 'hsl(170, 90%, 45%)',
    green: 'hsl(140, 85%, 45%)'
  }
  return colors[themeColor.value] || colors.primary
})

const secondaryColor = computed(() => {
  const colors = {
    primary: 'hsl(220, 80%, 75%)',
    orange: 'hsl(25, 80%, 70%)',
    blue: 'hsl(200, 80%, 70%)',
    purple: 'hsl(275, 80%, 75%)',
    teal: 'hsl(170, 80%, 65%)',
    green: 'hsl(140, 75%, 65%)'
  }
  return colors[themeColor.value] || colors.primary
})

const chartData = computed(() => {
  if (!Array.isArray(props.widgetValue)) return []
  return props.widgetValue
})

// Math parameters
const maxVal = computed(() => {
  if (!chartData.value.length) return 100
  const max = Math.max(...chartData.value.map(d => d.value), 0)
  return max === 0 ? 100 : max
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

const getHeight = (val) => {
  const heightRatio = val / maxVal.value
  return 200 * heightRatio
}

const formatYLabel = (val) => {
  if (val >= 100000) return `${(val / 1000).toFixed(0)}k`
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`
  return val.toFixed(0)
}

const formatTooltip = (val) => {
  return typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : val
}

const truncateLabel = (lbl) => {
  const stringLabel = String(lbl || '')
  return stringLabel.length > 10 ? `${stringLabel.substring(0, 8)}...` : stringLabel
}
</script>

<style lang="scss" scoped>
.dashboard-widget-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  min-height: 350px;
  height: auto;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 30px 0 rgba(0, 0, 0, 0.12);
  }
}

.chart-container {
  width: 100%;
  height: auto;
  aspect-ratio: 500 / 280;
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
