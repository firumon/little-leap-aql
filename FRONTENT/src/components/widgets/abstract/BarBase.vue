<template>
  <div ref="el" class="aql-widget aql-widget-bar">
    <div v-if="!hasValidData" class="aql-widget-empty">
      <slot name="empty">
        <q-icon :name="emptyIcon" size="28px" :color="emptyIconColor" />
        <div class="aql-widget-empty__text">
          <Renderable :value="emptyText" />
        </div>
      </slot>
    </div>

    <svg
      v-else
      class="aql-widget__svg"
      :viewBox="`0 0 ${width} ${svgHeight}`"
    >
      <template v-if="isHoriz">
        <template v-if="showLegend && normalizedSeries.length > 1 && tier !== 'micro'">
          <g v-for="(s, si) in legendItems" :key="`hleg-${si}`">
            <rect
              :x="s.x"
              :y="4"
              width="9"
              height="9"
              rx="2"
              :fill="s.color"
            />
            <text
              :x="s.x + 14"
              :y="12.5"
              font-size="11"
              class="aql-widget__sub-text"
            >
              {{ s.name }}
            </text>
          </g>
        </template>

        <line
          v-if="scale.lo < 0 && mode !== 'percent100'"
          :x1="hZeroX"
          :y1="hTop"
          :x2="hZeroX"
          :y2="hTop + hPlotHeight"
          class="aql-widget__zero-line"
          stroke-dasharray="3 3"
        />

        <g :transform="`translate(0, ${hTop})`">
          <g v-for="(row, ri) in hRows" :key="ri">
            <template v-if="tier !== 'micro'">
              <text
                :x="2"
                :y="row.y + 13"
                font-size="11.5"
                class="aql-widget__sub-text"
              >
                {{ truncate(row.label, Math.max(40, width - (showValueLabels && row.totalLabel ? 65 : 10)), 11.5) }}
              </text>
              <text
                v-if="showValueLabels && row.totalLabel"
                :x="width - 2"
                :y="row.y + 13"
                font-size="11.5"
                class="aql-widget__value-text"
                text-anchor="end"
              >
                {{ row.totalLabel }}
              </text>
            </template>

            <rect
              :x="row.trackX"
              :y="row.barY"
              :width="row.trackW"
              :height="row.barH"
              :rx="mode === 'percent100' || mode === 'stacked' ? 0 : row.barH / 2"
              class="aql-widget__track-bg"
              opacity="0.55"
            />

            <g v-for="(seg, si) in row.segments" :key="si">
              <rect
                v-if="seg.w > 0"
                :x="seg.x"
                :y="seg.y"
                :width="seg.w"
                :height="seg.h"
                :rx="mode === 'percent100' || mode === 'stacked' ? 0 : seg.h / 2"
                :fill="seg.color"
              />
              <text
                v-if="mode === 'percent100' && seg.fits"
                :x="seg.x + seg.w / 2"
                :y="seg.y + seg.h / 2 + 3.5"
                font-size="9"
                text-anchor="middle"
                :fill="seg.textColor"
                class="aql-widget__mono"
              >
                {{ seg.pctStr }}
              </text>
            </g>
          </g>
        </g>
      </template>

      <template v-else>
        <template v-if="showLegend && normalizedSeries.length > 1 && tier !== 'micro'">
          <g v-for="(s, si) in legendItems" :key="si">
            <rect
              :x="s.x"
              :y="4"
              width="9"
              height="9"
              rx="2"
              :fill="s.color"
            />
            <text
              :x="s.x + 14"
              :y="12.5"
              font-size="11"
              class="aql-widget__sub-text"
            >
              {{ truncate(s.name, 90, 11) }}
            </text>
          </g>
        </template>

        <g v-for="(tick, ti) in vGridLines" :key="`g-${ti}`">
          <line
            :x1="0"
            :y1="tick.y"
            :x2="width"
            :y2="tick.y"
            :class="tick.val === 0 ? 'aql-widget__zero-line' : 'aql-widget__grid-line'"
          />
        </g>

        <g v-for="(col, ci) in vColumns" :key="ci">
          <rect
            v-for="(bar, bi) in col.bars"
            :key="bi"
            :x="bar.x"
            :y="bar.y"
            :width="bar.w"
            :height="bar.h"
            :rx="mode === 'stacked' || mode === 'percent100' ? 0 : 3"
            :fill="bar.color"
          />

          <text
            v-if="showValueLabels && tier !== 'micro' && col.totalLabel"
            :x="col.totalX || col.cx"
            :y="col.labelY"
            font-size="11"
            class="aql-widget__value-text"
            :text-anchor="col.totalAnchor || 'middle'"
          >
            {{ col.totalLabel }}
          </text>

          <text
            v-if="tier !== 'micro'"
            :x="col.labelX"
            :y="vPlotBottom + 16"
            font-size="10.5"
            class="aql-widget__sub-text"
            :text-anchor="col.labelAnchor"
          >
            {{ truncate(col.cat, col.maxLabelW, 10.5) }}
          </text>
        </g>
      </template>
    </svg>
  </div>
</template>

<script>
export const ROW_HEIGHT = 46
</script>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { useWidgetPalette } from 'src/composables/widgets/useWidgetPalette.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import {
  truncate,
  signed,
  formatShort,
  tierAtLeast
} from 'src/utils/widgetGeometry.js'
import {
  computeBarScale,
  computeHorizontalRows,
  computeVerticalColumns
} from 'src/composables/widgets/useBarLayout.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  items: { type: Array, default: null },
  series: { type: Array, default: null },
  orientation: {
    type: String,
    default: 'auto',
    validator: (v) => ['horizontal', 'vertical', 'auto'].includes(v)
  },
  mode: {
    type: String,
    default: 'single',
    validator: (v) => ['single', 'grouped', 'stacked', 'percent100'].includes(v)
  },
  barWidth: {
    type: String,
    default: 'normal',
    validator: (v) => ['slim', 'normal', 'thick'].includes(v)
  },
  rowHeight: { type: Number, default: ROW_HEIGHT },
  showValueLabels: { type: Boolean, default: true },
  signColor: { type: Boolean, default: false },
  color: { type: String, default: 'primary' },
  valueFormat: { type: Function, default: null },
  minTier: { type: String, default: 'micro' },
  emptyText: { type: [String, Function, Object], default: 'Nothing to show' },
  emptyIcon: { type: String, default: 'bar_chart' },
  emptyIconColor: { type: String, default: 'grey-5' }
})

const { el, width, height, tier } = useWidgetTier()
const { getSeriesColor } = useWidgetPalette()

const normalizedSeries = computed(() => {
  if (props.series && props.series.length) return props.series
  if (props.items && props.items.length) {
    return [{ name: '', items: props.items }]
  }
  return []
})

const hasValidData = computed(() => {
  const hasSeries = normalizedSeries.value.length > 0 &&
    normalizedSeries.value.some((s) => s.items && s.items.length > 0)
  if (!hasSeries) return false

  if (props.mode === 'percent100') {
    const hasNegative = normalizedSeries.value.some((s) =>
      (s.items || []).some((it) => (Number(it.value) || 0) < 0)
    )
    if (hasNegative) return false
  }

  return true
})

const totalSum = computed(() => {
  let sum = 0
  normalizedSeries.value.forEach((s) => {
    (s.items || []).forEach((it) => {
      sum += Number(it.value) || 0
    })
  })
  return sum
})

const categories = computed(() => {
  if (!normalizedSeries.value.length) return []
  return (normalizedSeries.value[0].items || []).map((i) => i.label || '')
})

const longestLabelLength = computed(() => {
  let max = 0
  categories.value.forEach((c) => {
    if (c.length > max) max = c.length
  })
  return max
})

const isHoriz = computed(() => {
  if (props.orientation === 'horizontal') return true
  if (props.orientation === 'vertical') return false
  return tier.value === 'compact' ||
    tier.value === 'micro' ||
    (longestLabelLength.value > 22 && tier.value !== 'wide')
})

const showLegend = computed(() => {
  return normalizedSeries.value.length > 1 && props.mode !== 'single'
})

const legendItems = computed(() => {
  if (tier.value === 'micro') return []
  const maxAvailableW = width.value - 10
  let lx = 0
  const items = []

  for (let si = 0; si < normalizedSeries.value.length; si++) {
    const s = normalizedSeries.value[si]
    const col = s.color ? resolveCssColor(s.color) : getSeriesColor(si)
    const remainingW = maxAvailableW - lx
    if (remainingW < 42) break
    const maxTextW = Math.min(90, remainingW - 22)
    const truncName = truncate(s.name || `Series ${si + 1}`, maxTextW, 11)
    const textW = truncName.length * 11 * 0.56
    items.push({
      name: truncName,
      color: col,
      x: lx
    })
    lx += Math.ceil(14 + textW + 14)
  }
  return items
})

function getItemColor (it, seriesIdx) {
  if (it.color) return resolveCssColor(it.color)
  if (props.signColor) {
    if (it.value < 0) return 'var(--q-negative)'
    if (it.value > 0) return 'var(--q-positive)'
  }
  return getSeriesColor(seriesIdx)
}

const scale = computed(() => {
  return computeBarScale(
    normalizedSeries.value,
    props.mode,
    categories.value,
    tier.value === 'wide'
  )
})

const hTop = computed(() => showLegend.value && tier.value !== 'micro' ? 22 : 0)
const hPlotHeight = computed(() => Math.max(props.rowHeight, categories.value.length * props.rowHeight))
const svgHeight = computed(() => {
  if (!isHoriz.value) return height.value
  return hTop.value + hPlotHeight.value + 6
})
const hZeroX = computed(() => {
  const { lo, hi } = scale.value
  const span = hi - lo || 1
  if (lo >= 0) return 0
  return (Math.abs(lo) / span) * width.value
})

const hRows = computed(() => {
  return computeHorizontalRows({
    categories: categories.value,
    normalizedSeries: normalizedSeries.value,
    scale: scale.value,
    width: width.value,
    plotH: hPlotHeight.value,
    barWidth: props.barWidth,
    tier: tier.value,
    mode: props.mode,
    getItemColor,
    valueFormat: props.valueFormat
  })
})

const vTop = computed(() => showLegend.value && tier.value !== 'micro' ? 24 : 14)
const vAxisH = computed(() => tier.value === 'micro' ? 4 : 24)
const vPlotH = computed(() => Math.max(10, height.value - vTop.value - vAxisH.value))
const vPlotBottom = computed(() => vTop.value + vPlotH.value)

const vZeroY = computed(() => {
  const { lo, hi } = scale.value
  const span = hi - lo || 1
  return vTop.value + (hi / span) * vPlotH.value
})

const vGridLines = computed(() => {
  const { lo, hi, ticks } = scale.value
  const span = hi - lo || 1
  return ticks.map((val) => {
    const y = vTop.value + ((hi - val) / span) * vPlotH.value
    return { val, y }
  })
})

const vColumns = computed(() => {
  return computeVerticalColumns({
    categories: categories.value,
    normalizedSeries: normalizedSeries.value,
    scale: scale.value,
    width: width.value,
    vPlotH: vPlotH.value,
    vZeroY: vZeroY.value,
    mode: props.mode,
    getItemColor,
    valueFormat: props.valueFormat
  })
})
</script>
