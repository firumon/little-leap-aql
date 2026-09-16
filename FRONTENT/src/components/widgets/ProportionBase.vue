<template>
  <div ref="el" class="aql-widget aql-widget-proportion">
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
      <template v-if="orientation === 'vertical'">
        <g v-for="(p, pi) in vPieces" :key="pi">
          <rect
            :x="p.x"
            :y="p.y"
            :width="p.w"
            :height="p.h"
            :rx="splitStyle === 'gap' ? 2 : 0"
            :fill="p.color"
          />
          <text
            v-if="p.h > 14 && tier !== 'micro'"
            :x="p.x + p.w + 12"
            :y="p.y + p.h / 2 + 4"
            font-size="11"
            class="aql-widget__sub-text"
          >
            {{ truncate(p.label, Math.max(30, width - p.w - 55), 11) }} {{ Math.round(p.share * 100) }}%
          </text>
        </g>
      </template>

      <template v-else>
        <g v-for="(p, pi) in hPieces" :key="pi">
          <rect
            :x="p.x"
            :y="hBarTop"
            :width="p.w"
            :height="hBarHeight"
            :rx="splitStyle === 'gap' ? 2 : 0"
            :fill="p.color"
          />
          <text
            v-if="p.showInsideText"
            :x="p.x + p.w / 2"
            :y="hBarTop + hBarHeight / 2 + 4"
            font-size="10.5"
            :fill="p.textColor"
            font-weight="700"
            class="aql-widget__mono"
            text-anchor="middle"
          >
            {{ Math.round(p.share * 100) }}%
          </text>
        </g>

        <template v-if="tier !== 'micro'">
          <g v-for="(leg, li) in hLegend" :key="`leg-${li}`">
            <circle
              v-if="!leg.isMore"
              :cx="leg.x + 4"
              :cy="leg.y - 4"
              r="4"
              :fill="leg.color"
            />
            <text
              :x="leg.isMore ? leg.x + 4 : leg.x + 14"
              :y="leg.y"
              font-size="11"
              :class="leg.isMore ? 'aql-widget__faint-text' : 'aql-widget__sub-text'"
            >
              {{ truncate(leg.label, leg.maxW, 11) }}
            </text>
            <text
              :x="leg.x + leg.colW - 12"
              :y="leg.y"
              font-size="11"
              class="aql-widget__value-text"
              text-anchor="end"
            >
              {{ formatNumber(leg.value) }}
            </text>
          </g>
        </template>
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
import { formatNumber, truncate } from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  orientation: {
    type: String,
    default: 'horizontal',
    validator: (v) => ['horizontal', 'vertical'].includes(v)
  },
  splitStyle: {
    type: String,
    default: 'continuous',
    validator: (v) => ['continuous', 'gap'].includes(v)
  },
  barHeight: {
    type: String,
    default: 'thin',
    validator: (v) => ['thin', 'thick'].includes(v)
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
    default: 'view_week'
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

function getColor (it, idx) {
  if (it.color) return resolveCssColor(it.color)
  return getSeriesColor(idx)
}

const hBarHeight = computed(() => props.barHeight === 'thick' ? 22 : 14)
const hBarTop = computed(() => tier.value === 'micro' ? Math.max(0, (height.value - hBarHeight.value) / 2) : 4)

const hPieces = computed(() => {
  if (!hasValidData.value) return []
  const tot = total.value
  const w = width.value
  const gap = props.splitStyle === 'gap' ? 2 : 0
  const count = props.items.length
  const usableW = Math.max(0, w - gap * (count - 1))
  let currentX = 0

  return props.items.map((it, i) => {
    const val = Number(it.value) || 0
    const share = val / tot
    const pieceW = Math.max(0, share * usableW)
    const x = currentX
    currentX += pieceW + gap
    const isCustomColor = Boolean(it.color)
    const isDarkSeries = (i % 8) < 4
    const showInsideText = !isCustomColor && pieceW > 34 && tier.value !== 'micro'
    const textColor = isDarkSeries ? 'var(--aql-widget-on-fill)' : 'var(--aql-widget-ink)'

    return {
      label: it.label || '',
      value: val,
      share,
      x,
      w: pieceW,
      color: getColor(it, i),
      showInsideText,
      textColor
    }
  })
})

const hLegend = computed(() => {
  if (!hasValidData.value || tier.value === 'micro') return []
  const cols = tier.value === 'wide' ? 3 : 2
  const colW = Math.floor(width.value / cols)
  const top = hBarTop.value + hBarHeight.value + 16
  const availH = height.value - top
  const maxRows = Math.max(0, Math.floor(availH / 19))
  if (maxRows <= 0) return []

  const totalSlots = maxRows * cols
  const items = props.items
  const itemsFit = items.length <= totalSlots
  const visibleItemCount = itemsFit ? items.length : Math.max(0, totalSlots - 1)
  const result = []

  for (let i = 0; i < visibleItemCount; i++) {
    const it = items[i]
    const r = Math.floor(i / cols)
    const c = i % cols
    const lx = c * colW
    const ly = top + r * 19

    result.push({
      label: it.label || '',
      value: Number(it.value) || 0,
      x: lx,
      y: ly,
      colW,
      maxW: Math.max(15, colW - 65),
      color: getColor(it, i),
      isMore: false
    })
  }

  if (!itemsFit && visibleItemCount < items.length) {
    const leftover = items.slice(visibleItemCount)
    const leftoverCount = leftover.length
    const leftoverSum = leftover.reduce((acc, it) => acc + (Number(it.value) || 0), 0)
    const slotIdx = visibleItemCount
    const r = Math.floor(slotIdx / cols)
    const c = slotIdx % cols
    const lx = c * colW
    const ly = top + r * 19

    result.push({
      label: `+${leftoverCount} more`,
      value: leftoverSum,
      x: lx,
      y: ly,
      colW,
      maxW: Math.max(15, colW - 65),
      color: 'var(--aql-widget-muted)',
      isMore: true
    })
  }

  return result
})

const vPieces = computed(() => {
  if (!hasValidData.value) return []
  const tot = total.value
  const bw = props.barHeight === 'thick' ? Math.min(width.value * 0.44, 70) : Math.min(width.value * 0.25, 40)
  const x = 0
  const y = 6
  const hh = Math.max(10, height.value - 12)
  const gap = props.splitStyle === 'gap' ? 2 : 0
  const count = props.items.length
  const usableH = Math.max(0, hh - gap * (count - 1))
  let currentY = y + hh

  return props.items.map((it, i) => {
    const val = Number(it.value) || 0
    const share = val / tot
    const pieceH = Math.max(0, share * usableH)
    currentY -= pieceH
    const itemY = currentY
    currentY -= gap

    return {
      label: it.label || '',
      value: val,
      share,
      x,
      y: itemY,
      w: bw,
      h: pieceH,
      color: getColor(it, i)
    }
  })
})
</script>
