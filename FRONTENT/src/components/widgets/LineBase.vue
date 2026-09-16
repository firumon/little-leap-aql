<template>
  <div ref="el" class="aql-widget aql-widget-line">
    <div v-if="!hasValidData" class="aql-widget-empty">
      <slot name="empty">
        <q-icon :name="emptyIcon" size="28px" :color="emptyIconColor" />
        <div class="aql-widget-empty__text">
          <Renderable :value="emptyText" />
        </div>
      </slot>
    </div>

    <svg
      v-else-if="width > 0 && height > 0"
      class="aql-widget__svg"
      :viewBox="`0 0 ${width} ${height}`"
    >
      <defs>
        <template v-for="s in seriesData" :key="`def-${s.gradId}`">
          <linearGradient
            v-if="s.fillType === 'fade'"
            :id="s.gradId"
            x1="0"
            :y1="layoutBounds.top"
            x2="0"
            :y2="layoutBounds.top + layoutBounds.plotH"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" :stop-color="s.color" stop-opacity="0.32" />
            <stop :offset="`${(s.offsetZero * 100).toFixed(1)}%`" :stop-color="s.color" stop-opacity="0.03" />
            <stop offset="100%" :stop-color="s.color" stop-opacity="0.32" />
          </linearGradient>
        </template>
      </defs>

      <!-- Series Legend at top -->
      <g v-if="hasLegend">
        <template v-for="(leg, li) in legendItems" :key="`leg-${li}`">
          <rect
            :x="leg.x"
            :y="5"
            width="8"
            height="8"
            rx="2"
            :fill="leg.color"
          />
          <text
            :x="leg.x + 12"
            :y="12.5"
            font-size="11"
            class="aql-widget__sub-text"
          >
            {{ leg.name }}
          </text>
        </template>
      </g>

      <!-- Grid lines & Y-axis labels -->
      <g v-if="gridLines.length">
        <template v-for="(g, gi) in gridLines" :key="`grid-${gi}`">
          <line
            :x1="g.x1"
            :y1="g.y"
            :x2="g.x2"
            :y2="g.y"
            :class="g.isZero ? 'aql-widget__zero-line' : 'aql-widget__grid-line'"
          />
          <text
            v-if="showYAxis"
            :x="g.labelX"
            :y="g.y + 3.5"
            font-size="10"
            text-anchor="end"
            class="aql-widget__sub-text aql-widget__mono"
          >
            {{ g.labelText }}
          </text>
        </template>
      </g>

      <!-- Series Area & Lines -->
      <g v-for="s in seriesData" :key="s.name || 's0'">
        <!-- Area Fill -->
        <path
          v-if="s.areaD"
          :d="s.areaD"
          :fill="s.fillType === 'fade' ? `url(#${s.gradId})` : s.color"
          :opacity="s.fillType === 'solid' ? 0.22 : 1"
        />

        <!-- Line Stroke -->
        <path
          :d="s.lineD"
          fill="none"
          :stroke="s.color"
          :stroke-width="s.strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Individual Data Points -->
        <template v-if="showPoints && tier !== 'micro'">
          <circle
            v-for="(p, pi) in s.points"
            :key="`pt-${pi}`"
            :cx="p.x"
            :cy="p.y"
            r="3"
            fill="var(--aql-widget-surface)"
            :stroke="s.color"
            stroke-width="2"
          />
        </template>

        <!-- End Dot -->
        <circle
          v-if="showEndDot && s.endDot"
          :cx="s.endDot.x"
          :cy="s.endDot.y"
          r="3.5"
          :fill="s.color"
        />
      </g>

      <!-- Date ticks on X axis -->
      <g v-if="dateTicks.length">
        <text
          v-for="(dt, di) in dateTicks"
          :key="`date-${di}`"
          :x="dt.x"
          :y="dt.y"
          font-size="10"
          :text-anchor="dt.anchor"
          class="aql-widget__sub-text aql-widget__mono"
        >
          {{ dt.label }}
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { useWidgetPalette } from 'src/composables/widgets/useWidgetPalette.js'
import { useLineLayout } from 'src/composables/widgets/useLineLayout.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  points: {
    type: Array,
    default: () => []
  },
  series: {
    type: Array,
    default: () => []
  },
  curve: {
    type: String,
    default: 'smooth',
    validator: (v) => ['smooth', 'straight', 'step'].includes(v)
  },
  fill: {
    type: String,
    default: 'none',
    validator: (v) => ['none', 'fade', 'solid'].includes(v)
  },
  lineWidth: {
    type: String,
    default: 'medium',
    validator: (v) => ['thin', 'medium'].includes(v)
  },
  showGrid: {
    type: Boolean,
    default: true
  },
  showPoints: {
    type: Boolean,
    default: false
  },
  showEndDot: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: 'primary'
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'show_chart'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()
const { getSeriesColor } = useWidgetPalette()

const seriesList = computed(() => {
  if (props.series && props.series.length) {
    return props.series
  }
  if (props.points && props.points.length) {
    return [{ name: '', points: props.points }]
  }
  return []
})

const {
  hasValidData,
  hasLegend,
  showYAxis,
  layoutBounds,
  dateTicks,
  gridLines,
  seriesData,
  legendItems
} = useLineLayout({
  seriesList,
  width,
  height,
  tier,
  curve: computed(() => props.curve),
  fill: computed(() => props.fill),
  lineWidth: computed(() => props.lineWidth),
  showGrid: computed(() => props.showGrid),
  showPoints: computed(() => props.showPoints),
  showEndDot: computed(() => props.showEndDot),
  color: computed(() => props.color),
  getSeriesColor
})
</script>
