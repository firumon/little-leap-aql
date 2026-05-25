<template>
  <q-card class="dashboard-widget-card donut-chart-widget overflow-hidden relative-position">
    <q-card-section class="q-pa-md">
      <div class="row items-center justify-between no-wrap q-mb-md">
        <q-item class="q-pa-none q-item-no-link no-wrap col" style="min-height: auto;">
          <q-item-section avatar class="q-pr-sm min-width-auto" style="min-width: auto;">
            <q-icon :name="widgetConfig.metadata.config.icon || 'pie_chart'" size="24px" :class="`text-${themeColor}`" />
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

      <div v-if="loading" class="q-pa-md row items-center justify-center" style="height: 240px;">
        <q-skeleton type="circle" size="140px" class="opacity-40 q-mr-lg" />
        <div class="column q-gutter-xs col">
          <q-skeleton type="text" width="60%" />
          <q-skeleton type="text" width="40%" />
          <q-skeleton type="text" width="50%" />
        </div>
      </div>

      <div v-else-if="chartData.length === 0" class="column items-center justify-center text-grey-5" style="height: 240px;">
        <q-icon name="pie_chart_outline" size="3rem" class="q-mb-sm text-grey-4" />
        <div class="text-subtitle2">{{ widgetConfig.metadata.config.chart?.emptyMessage || 'No distribution data available' }}</div>
      </div>

      <div v-else class="row items-center justify-between no-wrap q-col-gutter-md" style="height: 250px;">
        <!-- SVG Donut Circle -->
        <div class="col-6 flex flex-center">
          <svg viewBox="0 0 200 200" class="donut-svg" style="max-height: 200px;">
            <g transform="rotate(-90, 100, 100)">
              <!-- Base gray circle -->
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="transparent"
                stroke="#f1f5f9"
                stroke-width="18"
              />
              <!-- Colored slices -->
              <circle
                v-for="(slice, idx) in slices"
                :key="`slice-${idx}`"
                cx="100"
                cy="100"
                r="70"
                fill="transparent"
                :stroke="slice.color"
                stroke-width="18"
                :stroke-dasharray="`${slice.length} ${circumference}`"
                :stroke-dashoffset="-slice.offset"
                stroke-linecap="butt"
                class="donut-segment"
                @mouseenter="hoveredIndex = idx"
                @mouseleave="hoveredIndex = -1"
              >
                <q-tooltip class="bg-grey-9 q-pa-xs">
                  <div class="text-weight-bold">{{ slice.label }}</div>
                  <div>{{ formatValue(slice.value) }} ({{ slice.percentage.toFixed(1) }}%)</div>
                </q-tooltip>
              </circle>
            </g>

            <!-- Center text -->
            <text x="100" y="96" text-anchor="middle" class="center-title-text">
              {{ hoveredSlice ? hoveredSlice.label : 'Total' }}
            </text>
            <text x="100" y="116" text-anchor="middle" class="center-value-text">
              {{ hoveredSlice ? formatValue(hoveredSlice.value) : formatValue(totalVal) }}
            </text>
          </svg>
        </div>

        <!-- Legend -->
        <div class="col-6 q-pl-md scroll-container column justify-center" style="max-height: 220px; overflow-y: auto;">
          <div
            v-for="(item, idx) in slices"
            :key="`legend-${idx}`"
            class="row items-center justify-between no-wrap q-py-xs legend-row rounded-borders cursor-pointer q-px-sm"
            :class="{ 'active-legend': hoveredIndex === idx }"
            @mouseenter="hoveredIndex = idx"
            @mouseleave="hoveredIndex = -1"
          >
            <div class="row items-center no-wrap ellipsis q-pr-sm">
              <div class="color-dot q-mr-sm" :style="{ backgroundColor: item.color }"></div>
              <span class="legend-label text-caption text-weight-medium text-grey-8 ellipsis">
                {{ item.label }}
              </span>
            </div>
            <div class="text-caption text-weight-bold text-grey-9 text-right no-wrap">
              {{ formatValue(item.value) }}
            </div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, ref } from 'vue'

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

const hoveredIndex = ref(-1)

const themeColor = computed(() => props.widgetConfig.metadata.config.color || 'primary')

const chartData = computed(() => {
  if (!Array.isArray(props.widgetValue)) return []
  return props.widgetValue.filter(item => item && item.value > 0)
})

const totalVal = computed(() => {
  return chartData.value.reduce((acc, item) => acc + item.value, 0)
})

// Math setup
const radius = 70
const circumference = 2 * Math.PI * radius // 439.8229715

const colorPalette = [
  'hsl(220, 85%, 55%)',  // primary blue
  'hsl(25, 90%, 55%)',   // orange
  'hsl(170, 85%, 45%)',  // teal
  'hsl(275, 80%, 60%)',  // purple
  'hsl(200, 85%, 50%)',  // light blue
  'hsl(140, 75%, 45%)',  // green
  'hsl(340, 80%, 55%)',  // pink
  'hsl(45, 90%, 50%)'    // yellow
]

const slices = computed(() => {
  let currentOffset = 0
  return chartData.value.map((item, idx) => {
    const percentage = totalVal.value > 0 ? (item.value / totalVal.value) : 0
    const length = percentage * circumference
    const offset = currentOffset
    currentOffset += length

    // Dynamic color selection
    const color = item.color || colorPalette[idx % colorPalette.length]

    return {
      label: item.label,
      value: item.value,
      percentage: percentage * 100,
      length,
      offset,
      color
    }
  })
})

const hoveredSlice = computed(() => {
  if (hoveredIndex.value >= 0 && hoveredIndex.value < slices.value.length) {
    return slices.value[hoveredIndex.value]
  }
  return null
})

const formatValue = (val) => {
  if (typeof val === 'number') {
    return val >= 1000 ? val.toLocaleString() : val.toString()
  }
  return String(val || '')
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

.donut-svg {
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.06));
}

.donut-segment {
  transition: stroke-width 0.25s ease, filter 0.25s ease;
  cursor: pointer;

  &:hover {
    stroke-width: 22;
  }
}

.center-title-text {
  font-size: 11px;
  fill: #64748b;
  font-weight: 500;
  max-width: 90px;
  font-family: inherit;
}

.center-value-text {
  font-size: 18px;
  font-weight: 700;
  fill: #1e293b;
  font-family: inherit;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  font-size: 11px;
  max-width: 80px;
}

.legend-row {
  transition: all 0.2s ease;

  &:hover, &.active-legend {
    background: #f1f5f9;
  }
}

.scroll-container::-webkit-scrollbar {
  width: 4px;
}
.scroll-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
</style>
