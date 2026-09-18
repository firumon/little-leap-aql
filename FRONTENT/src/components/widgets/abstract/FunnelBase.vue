<template>
  <div ref="el" class="aql-widget aql-widget-funnel">
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
      <template v-if="direction === 'horizontal'">
        <g v-for="(s, si) in hSteps" :key="si">
          <path
            :d="s.path"
            :fill="s.color"
          />
          <text
            v-if="tier !== 'micro'"
            :x="si === 0 ? s.x + 2 : si === hSteps.length - 1 ? s.x + s.colW - 2 : s.cx"
            :y="height - 8"
            font-size="10"
            class="aql-widget__sub-text"
            :text-anchor="si === 0 ? 'start' : si === hSteps.length - 1 ? 'end' : 'middle'"
          >
            {{ truncate(s.label, s.colW - 4, 10) }}
          </text>
        </g>
      </template>

      <template v-else>
        <g v-for="(s, si) in vSteps" :key="si">
          <path
            :d="s.path"
            :fill="s.color"
          />
          <template v-if="tier !== 'micro' && s.rowH > 24">
            <text
              :x="width / 2"
              :y="s.y + s.rowH / 2 - 2"
              font-size="11"
              :fill="s.textColor"
              font-weight="600"
              text-anchor="middle"
            >
              {{ truncate(s.label, Math.max(50, s.wB - 16), 11) }}
            </text>
            <text
              :x="width / 2"
              :y="s.y + s.rowH / 2 + 12"
              font-size="10.5"
              :fill="s.textColor"
              class="aql-widget__mono"
              text-anchor="middle"
              :opacity="s.isDark ? 0.88 : 1"
            >
              {{ formatValue(s.value, valueFormat, formatNumber(s.value)) }} · {{ Math.round(s.pct * 100) }}%
            </text>
          </template>
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
  formatNumber,
  formatShort,
  formatValue,
  truncate,
  tierAtLeast
} from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  direction: {
    type: String,
    default: 'vertical',
    validator: (v) => ['vertical', 'horizontal'].includes(v)
  },
  shape: {
    type: String,
    default: 'smooth',
    validator: (v) => ['stepped', 'smooth'].includes(v)
  },
  neckStyle: {
    type: String,
    default: 'straight',
    validator: (v) => ['straight', 'pinch'].includes(v)
  },
  color: {
    type: String,
    default: 'primary'
  },
  valueFormat: {
    type: Function,
    default: null
  },
  minTier: {
    type: String,
    default: 'compact'
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'filter_alt'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()
const { getSeriesColor } = useWidgetPalette()

const topVal = computed(() => {
  if (!props.items || !props.items.length) return 0
  return Number(props.items[0].value) || 0
})

const hasValidData = computed(() => {
  const list = props.items || []
  if (!list.length || topVal.value <= 0) return false
  return list.every((it) => {
    const v = Number(it.value)
    return !isNaN(v) && v >= 0
  })
})

function getColor (it, i) {
  if (it.color) return resolveCssColor(it.color)
  return getSeriesColor(i)
}

const vSteps = computed(() => {
  if (!hasValidData.value) return []
  const list = props.items
  const top = topVal.value
  const rowH = Math.max(10, (height.value - 2) / list.length)
  const w = width.value

  return list.map((it, i) => {
    const v0 = Number(it.value) || 0
    let v1 = v0
    if (props.shape === 'smooth') {
      if (list[i + 1]) {
        v1 = Number(list[i + 1].value) || 0
      } else {
        v1 = props.neckStyle === 'pinch' ? v0 * 0.6 : v0
      }
    }

    const f0 = top > 0 ? v0 / top : 0
    const f1 = top > 0 ? v1 / top : 0
    const wA = w * f0
    const wB = w * f1
    const y = i * rowH
    const path = `M ${(w - wA) / 2} ${y} L ${(w + wA) / 2} ${y} L ${(w + wB) / 2} ${y + rowH - 3} L ${(w - wB) / 2} ${y + rowH - 3} Z`
    const isDark = (i % 8) < 4
    const textColor = isDark ? 'var(--aql-widget-on-fill)' : 'var(--aql-widget-ink)'

    return {
      label: it.label || '',
      value: v0,
      pct: top > 0 ? v0 / top : 0,
      path,
      y,
      rowH,
      wB,
      isDark,
      textColor,
      color: getColor(it, i)
    }
  })
})

const hSteps = computed(() => {
  if (!hasValidData.value) return []
  const list = props.items
  const top = topVal.value
  const pad = 4
  const usableW = Math.max(10, width.value - pad * 2)
  const colW = Math.floor(usableW / list.length)
  const plotH = Math.max(10, height.value - 26)
  const mid = plotH / 2

  return list.map((it, i) => {
    const v0 = Number(it.value) || 0
    let v1 = v0
    if (props.shape === 'smooth') {
      if (list[i + 1]) {
        v1 = Number(list[i + 1].value) || 0
      } else {
        v1 = props.neckStyle === 'pinch' ? v0 * 0.6 : v0
      }
    }

    const f0 = top > 0 ? v0 / top : 0
    const f1 = top > 0 ? v1 / top : 0
    const h0 = plotH * f0
    const h1 = plotH * f1
    const x = pad + i * colW
    const path = `M ${x} ${mid - h0 / 2} L ${x + colW - 2} ${mid - h1 / 2} L ${x + colW - 2} ${mid + h1 / 2} L ${x} ${mid + h0 / 2} Z`

    return {
      label: it.label || '',
      path,
      x,
      cx: x + colW / 2,
      colW,
      color: getColor(it, i)
    }
  })
})
</script>
