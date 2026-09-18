<template>
  <div ref="el" class="aql-widget aql-widget-donut">
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
      <g>
        <path
          v-for="(s, si) in slices"
          :key="si"
          :d="s.path"
          :fill="s.color"
        />
      </g>

      <template v-if="holeSize !== 'none' && sweepAngle !== 'half' && tier !== 'micro'">
        <text
          :x="cx"
          :y="cy - 2"
          :font-size="rOuter > 60 ? 22 : 17"
          class="aql-widget__value-text"
          text-anchor="middle"
        >
          {{ formatValue(total, valueFormat, formatShort(total)) }}
        </text>
        <text
          :x="cx"
          :y="cy + 15"
          font-size="11"
          class="aql-widget__sub-text"
          text-anchor="middle"
        >
          total
        </text>
      </template>

      <g v-if="!isWide && !isHalf && smallLeaders.length > 0 && tier !== 'micro'">
        <g v-for="(lead, li) in smallLeaders" :key="`lead-${li}`">
          <path
            :d="lead.path"
            class="aql-widget__leader-line"
          />
          <text
            :x="lead.tx"
            :y="lead.ty - 6"
            font-size="10.5"
            class="aql-widget__sub-text"
          >
            {{ truncate(lead.label, Math.max(15, width - lead.tx - 8), 10.5) }}
          </text>
          <text
            :x="lead.tx"
            :y="lead.ty + 6"
            font-size="10"
            class="aql-widget__faint-text"
          >
            {{ lead.pctStr }}
          </text>
        </g>
      </g>

      <template v-if="tier !== 'micro'">
        <g v-for="(leg, gi) in legendItems" :key="`leg-${gi}`">
          <circle
            :cx="leg.x + 4"
            :cy="leg.y - 4"
            r="4.5"
            :fill="leg.color"
          />
          <text
            :x="leg.x + 14"
            :y="leg.y"
            font-size="11"
            class="aql-widget__sub-text"
          >
            {{ truncate(leg.label, leg.maxW, 11) }}
          </text>
          <text
            :x="leg.endX"
            :y="leg.y"
            font-size="11"
            class="aql-widget__value-text"
            text-anchor="end"
          >
            {{ leg.pctStr }}
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
  wedgePath,
  polar,
  formatShort,
  formatValue,
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
  holeSize: {
    type: String,
    default: 'medium',
    validator: (v) => ['none', 'medium', 'large'].includes(v)
  },
  sweepAngle: {
    type: String,
    default: 'full',
    validator: (v) => ['full', 'half'].includes(v)
  },
  sliceGap: {
    type: String,
    default: 'small',
    validator: (v) => ['none', 'small'].includes(v)
  },
  color: {
    type: String,
    default: 'primary'
  },
  valueFormat: {
    type: Function,
    default: null
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'pie_chart'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()
const { getSeriesColor } = useWidgetPalette()

const total = computed(() => {
  if (!props.items || !props.items.length) return 0
  return props.items.reduce((sum, it) => sum + (Number(it.value) || 0), 0)
})

const hasValidData = computed(() => {
  const list = props.items || []
  if (!list.length || total.value <= 0) return false
  return list.every((it) => {
    const v = Number(it.value)
    return !isNaN(v) && v >= 0
  })
})

const isWide = computed(() => tier.value === 'wide')
const isHalf = computed(() => props.sweepAngle === 'half')
const isPie = computed(() => props.holeSize === 'none')

const tinyCount = computed(() => {
  if (!hasValidData.value) return 0
  const tot = total.value
  return props.items.filter((it) => (Number(it.value) || 0) / tot < 0.06).length
})

const gutter = computed(() => {
  if (!isWide.value && tinyCount.value > 0) {
    return Math.min(130, width.value * 0.34)
  }
  return 0
})

const boxW = computed(() => {
  if (isWide.value) return width.value * 0.44
  return width.value - gutter.value
})

const maxLegendRows = computed(() => {
  if (tier.value === 'micro' || isWide.value || !hasValidData.value) return 0
  const minRingH = isHalf.value ? 28 : 46
  const availForLegend = Math.max(0, height.value - minRingH)
  return Math.min(5, Math.max(1, Math.floor((availForLegend - 10) / 18)))
})

const legendHeight = computed(() => {
  if (maxLegendRows.value <= 0) return 0
  const count = Math.min(props.items.length, maxLegendRows.value)
  return count * 18 + 10
})

const ringArea = computed(() => Math.max(20, height.value - legendHeight.value))

const rOuter = computed(() => {
  const bw = boxW.value
  const ra = ringArea.value
  const hLimit = isHalf.value ? ra - 16 : (ra - 16) / 2
  return Math.max(16, Math.floor(Math.min(bw / 2 - 8, hLimit)))
})

const rInner = computed(() => {
  if (isPie.value) return 0
  if (props.holeSize === 'large') return Math.floor(rOuter.value * 0.72)
  return Math.floor(rOuter.value * 0.6)
})

const cx = computed(() => {
  if (isWide.value) return Math.floor(rOuter.value + 12)
  return Math.floor(boxW.value / 2)
})

const cy = computed(() => {
  if (isWide.value) return Math.floor(height.value / 2)
  if (isHalf.value) return Math.floor(rOuter.value + 8)
  return Math.floor(ringArea.value / 2)
})

function getColor (it, i) {
  if (it.color) return resolveCssColor(it.color)
  return getSeriesColor(i)
}

const slices = computed(() => {
  if (!hasValidData.value) return []
  const tot = total.value
  const span = isHalf.value ? 180 : 360
  const startAngle = isHalf.value ? 180 : -90
  const gap = props.sliceGap === 'small' ? 1.2 : 0
  let a = startAngle

  return props.items.map((it, i) => {
    const val = Number(it.value) || 0
    if (val <= 0) return null
    const sw = (val / tot) * span
    const a0 = a
    const a1 = a + sw - (sw > 4 ? gap : 0.1)
    a += sw

    return {
      label: it.label || '',
      value: val,
      share: val / tot,
      path: wedgePath(cx.value, cy.value, rInner.value, rOuter.value, a0, a1),
      midAngle: a0 + sw / 2,
      color: getColor(it, i)
    }
  }).filter(Boolean)
})

const smallLeaders = computed(() => {
  if (isWide.value || isHalf.value || !hasValidData.value) return []
  const smallSlices = slices.value.filter((s) => s.share > 0 && s.share < 0.06)
  const r = rOuter.value
  const center_x = cx.value
  const center_y = cy.value

  return smallSlices.map((s, k) => {
    const [px, py] = polar(center_x, center_y, r + 2, s.midAngle)
    const ty = center_y - r + 14 + k * 26
    const tx = Math.min(width.value - 44, center_x + r + 20)
    const path = `M${px.toFixed(1)} ${py.toFixed(1)} L${(center_x + r + 10).toFixed(1)} ${ty} L${tx - 4} ${ty}`
    return {
      path,
      tx,
      ty,
      label: s.label,
      pctStr: (s.share * 100).toFixed(1) + '%'
    }
  })
})

const legendItems = computed(() => {
  if (!hasValidData.value || tier.value === 'micro') return []
  const list = props.items

  if (isWide.value) {
    const lx = width.value * 0.48
    const top = Math.max(12, (height.value - list.length * 21) / 2 + 10)
    return list.map((it, i) => {
      const val = Number(it.value) || 0
      const pct = Math.round((val / total.value) * 100)
      const y = top + i * 21
      return {
        label: it.label || '',
        pctStr: `${pct}%`,
        x: lx,
        y,
        endX: width.value - 6,
        maxW: Math.max(30, width.value - lx - 60),
        color: getColor(it, i)
      }
    })
  }

  const displayItems = list.slice(0, maxLegendRows.value)
  const top = height.value - legendHeight.value + 12
  return displayItems.map((it, i) => {
    const val = Number(it.value) || 0
    const pct = total.value > 0 ? Math.round((val / total.value) * 100) : 0
    const y = top + i * 18
    return {
      label: it.label || '',
      pctStr: `${pct}%`,
      x: 4,
      y,
      endX: width.value - 8,
      maxW: Math.max(20, width.value - 70),
      color: getColor(it, i)
    }
  })
})
</script>
