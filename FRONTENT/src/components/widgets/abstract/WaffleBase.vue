<template>
  <div ref="el" class="aql-widget aql-widget-waffle">
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
      <g>
        <template v-for="cell in cells" :key="cell.i">
          <circle
            v-if="blockShape === 'circle'"
            :cx="cell.cx"
            :cy="cell.cy"
            :r="cell.r"
            :class="cell.on ? '' : 'aql-widget__waffle-cell--off'"
            :fill="cell.on ? activeColor : undefined"
          />
          <rect
            v-else
            :x="cell.x"
            :y="cell.y"
            :width="cell.size"
            :height="cell.size"
            rx="2"
            :class="cell.on ? '' : 'aql-widget__waffle-cell--off'"
            :fill="cell.on ? activeColor : undefined"
          />
        </template>
      </g>

      <text
        v-if="tier !== 'micro'"
        :x="width / 2"
        :y="labelY"
        font-size="12"
        class="aql-widget__value-text"
        text-anchor="middle"
      >
        {{ formatValue(numVal, valueFormat, formatNumber(numVal)) }} of {{ formatValue(numMax, valueFormat, formatNumber(numMax)) }} · {{ Math.round(pct * 100) }}%
      </text>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import { formatNumber, formatValue } from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  value: {
    type: [Number, String],
    default: null
  },
  max: {
    type: [Number, String],
    default: null
  },
  gridSize: {
    type: String,
    default: '10x10',
    validator: (v) => ['10x10', '5x5'].includes(v)
  },
  blockShape: {
    type: String,
    default: 'square',
    validator: (v) => ['square', 'circle'].includes(v)
  },
  fillDirection: {
    type: String,
    default: 'bottom-up',
    validator: (v) => ['bottom-up', 'left-right'].includes(v)
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
    default: 'grid_view'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()

const numVal = computed(() => Number(props.value))
const numMax = computed(() => Number(props.max))

const hasValidData = computed(() => {
  return numMax.value > 0 &&
    props.value !== null &&
    props.value !== undefined &&
    !isNaN(numVal.value) &&
    !isNaN(numMax.value)
})

const pct = computed(() => {
  if (!hasValidData.value) return 0
  return Math.min(1, Math.max(0, numVal.value / numMax.value))
})

const activeColor = computed(() => resolveCssColor(props.color))

const n = computed(() => props.gridSize === '5x5' ? 5 : 10)
const gap = computed(() => n.value === 5 ? 8 : 4)

const side = computed(() => {
  if (width.value <= 0 || height.value <= 0) return 0
  const hReserved = tier.value === 'micro' ? 0 : 26
  return Math.max(0, Math.min(width.value - 12, height.value - hReserved - 8))
})

const cellSize = computed(() => {
  if (side.value <= 0) return 0
  const available = side.value - gap.value * (n.value - 1)
  if (available <= 0) {
    return Math.max(1, side.value / n.value)
  }
  return Math.max(1, available / n.value)
})

const x0 = computed(() => (width.value - side.value) / 2)
const y0 = computed(() => tier.value === 'micro' ? (height.value - side.value) / 2 : 4)
const labelY = computed(() => y0.value + side.value + 20)

const cells = computed(() => {
  const count = n.value * n.value
  const filledCount = Math.round(pct.value * count)
  const list = []
  const cSize = cellSize.value
  const g = gap.value
  const startX = x0.value
  const startY = y0.value

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / n.value)
    const c = i % n.value
    const rowIdx = props.fillDirection === 'bottom-up' ? (n.value - 1 - r) : r
    const x = startX + c * (cSize + g)
    const y = startY + rowIdx * (cSize + g)
    const on = i < filledCount

    list.push({
      i,
      x,
      y,
      cx: x + cSize / 2,
      cy: y + cSize / 2,
      r: Math.max(0.5, cSize / 2),
      size: Math.max(1, cSize),
      on
    })
  }
  return list
})
</script>
