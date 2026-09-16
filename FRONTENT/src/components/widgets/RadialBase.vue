<template>
  <div ref="el" class="aql-widget aql-widget-radial">
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
      :viewBox="`0 0 ${width} ${height}`"
    >
      <g v-for="(ring, ri) in rings" :key="ri">
        <path
          v-if="trackBackground"
          :d="ring.trackPath"
          class="aql-widget__track"
          :stroke-width="strokeWidth"
          :stroke-linecap="capStyle === 'round' ? 'round' : 'butt'"
        />

        <path
          v-if="ring.valPath"
          :d="ring.valPath"
          :stroke="ring.color"
          :stroke-width="strokeWidth"
          :stroke-linecap="capStyle === 'round' ? 'round' : 'butt'"
          fill="none"
        />
      </g>

      <template v-if="hasLegend">
        <g v-for="(leg, li) in legendItems" :key="`leg-${li}`">
          <circle
            :cx="leg.x + 5"
            :cy="leg.y - 4"
            r="4.5"
            :fill="leg.color"
          />
          <text
            :x="leg.x + 16"
            :y="leg.y - 6"
            font-size="11"
            class="aql-widget__value-text"
          >
            {{ truncate(leg.label, leg.maxW, 11) }}
          </text>
          <text
            :x="leg.x + 16"
            :y="leg.y + 9"
            font-size="10.5"
            class="aql-widget__sub-text"
          >
            {{ truncate(`${formatNumber(leg.value)} / ${formatNumber(leg.max)} · ${Math.round(leg.pct * 100)}%`, leg.maxW, 10.5) }}
          </text>
        </g>
      </template>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { useWidgetPalette } from 'src/composables/widgets/useWidgetPalette.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import {
  arcPath,
  formatNumber,
  truncate
} from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  capStyle: {
    type: String,
    default: 'round',
    validator: (v) => ['round', 'flat'].includes(v)
  },
  sweep: {
    type: String,
    default: 'full',
    validator: (v) => ['full', 'horseshoe'].includes(v)
  },
  trackBackground: {
    type: Boolean,
    default: true
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
    default: 'donut_large'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()
const { getSeriesColor } = useWidgetPalette()

const visibleItems = computed(() => (props.items || []).slice(0, 5))

const hasValidData = computed(() => {
  const list = visibleItems.value
  if (!list.length) return false
  return list.every((it) => {
    const v = Number(it.value)
    const m = Number(it.max)
    return !isNaN(v) && !isNaN(m) && m > 0 && v >= 0
  })
})

const hasLegend = computed(() => width.value >= 320 && tier.value !== 'micro')

const boxW = computed(() => {
  if (hasLegend.value) return Math.min(width.value * 0.46, height.value)
  return width.value
})

const rMax = computed(() => {
  const bw = boxW.value
  const h = height.value
  return Math.max(16, Math.min(bw / 2 - 6, (h - 12) / 2))
})

const cx = computed(() => {
  if (hasLegend.value) return rMax.value + 8
  return width.value / 2
})

const cy = computed(() => height.value / 2)

const count = computed(() => Math.max(1, visibleItems.value.length))

const strokeWidth = computed(() => {
  const r = rMax.value
  return Math.max(6, (r * 0.9 / count.value) * 0.6)
})

const stepR = computed(() => {
  return (rMax.value - strokeWidth.value) / count.value
})

const angles = computed(() => {
  if (props.sweep === 'horseshoe') {
    return { a0: 135, a1: 405, span: 270 }
  }
  return { a0: -90, a1: 270, span: 360 }
})

function getColor (it, i) {
  if (it.color) return resolveCssColor(it.color)
  return getSeriesColor(i)
}

const rings = computed(() => {
  if (!hasValidData.value) return []
  const { a0, a1, span } = angles.value
  const th = strokeWidth.value
  const sR = stepR.value
  const rM = rMax.value
  const c_x = cx.value
  const c_y = cy.value

  return visibleItems.value.map((it, i) => {
    const r = rM - i * sR - th / 2
    const val = Number(it.value) || 0
    const m = Number(it.max) || 1
    const pct = Math.min(1, Math.max(0, val / m))
    const trackEnd = (span === 360) ? a0 + 359.99 : a1
    const trackP = arcPath(c_x, c_y, r, a0, trackEnd)

    let valP = ''
    if (pct > 0.001) {
      const endA = (span === 360 && pct >= 0.999) ? a0 + 359.99 : a0 + span * pct
      valP = arcPath(c_x, c_y, r, a0, endA)
    }

    return {
      r,
      trackPath: trackP,
      valPath: valP,
      color: getColor(it, i)
    }
  })
})

const legendItems = computed(() => {
  if (!hasLegend.value || !hasValidData.value) return []
  const list = visibleItems.value
  const lx = cx.value + rMax.value + 16
  const top = (height.value - list.length * 28) / 2 + 14

  return list.map((it, i) => {
    const val = Number(it.value) || 0
    const m = Number(it.max) || 1
    const pct = Math.min(1, Math.max(0, val / m))
    const y = top + i * 30

    return {
      label: it.label || '',
      value: val,
      max: m,
      pct,
      x: lx,
      y,
      maxW: Math.max(20, width.value - (lx + 16) - 16),
      color: getColor(it, i)
    }
  })
})
</script>
