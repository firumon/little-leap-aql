<template>
  <div ref="el" class="aql-widget aql-widget-heat-grid">
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
      <template v-if="colLabels.length && colLabH > 0">
        <text
          v-for="(col, ci) in colLabels"
          :key="`col-${ci}`"
          :x="col.cx"
          :y="10"
          font-size="10"
          class="aql-widget__sub-text"
          text-anchor="middle"
        >
          {{ truncate(col.text, col.w, 10) }}
        </text>
      </template>

      <g v-for="(r, ri) in rows" :key="`row-${ri}`">
        <text
          v-if="r.rowLabel && labW > 0"
          :x="0"
          :y="r.y + r.cellH / 2 + 4"
          font-size="11"
          class="aql-widget__sub-text"
        >
          {{ truncate(r.rowLabel, labW - 6, 11) }}
        </text>

        <g v-for="(cell, ci) in r.cells" :key="`c-${ci}`">
          <rect
            :x="cell.x"
            :y="r.y"
            :width="cell.w"
            :height="r.cellH"
            :rx="rx"
            :fill="activeColor"
            :opacity="cell.opacity"
          />

          <text
            v-if="cell.showNumber"
            :x="cell.x + cell.w / 2"
            :y="r.y + r.cellH / 2 + 4"
            font-size="10.5"
            :fill="cell.textColor"
            class="aql-widget__mono"
            font-weight="600"
            text-anchor="middle"
          >
            {{ cell.value }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import {
  formatShort,
  truncate,
  tierAtLeast
} from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  series: {
    type: Array,
    default: () => []
  },
  layout: {
    type: String,
    default: 'matrix',
    validator: (v) => ['strip', 'matrix'].includes(v)
  },
  cellRound: {
    type: String,
    default: 'none',
    validator: (v) => ['none', 'round'].includes(v)
  },
  cellGap: {
    type: String,
    default: 'tight',
    validator: (v) => ['tight', 'loose'].includes(v)
  },
  color: {
    type: String,
    default: 'primary'
  },
  minTier: {
    type: String,
    default: 'micro'
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'table_chart'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()

const activeSeries = computed(() => {
  const s = props.series || []
  if (!s.length) return []
  return props.layout === 'strip' ? s.slice(0, 1) : s
})

const allValues = computed(() => {
  return activeSeries.value.flatMap((r) => (r.items || []).map((i) => Number(i.value) || 0))
})

const hasValidData = computed(() => {
  return activeSeries.value.length > 0 &&
    allValues.value.length > 0 &&
    allValues.value.some((v) => v > 0)
})

const peakVal = computed(() => Math.max(1, ...allValues.value))

const activeColor = computed(() => resolveCssColor(props.color))
const rx = computed(() => props.cellRound === 'round' ? 4 : 0)
const gap = computed(() => props.cellGap === 'loose' ? 5 : 3)

const labW = computed(() => {
  if (tier.value === 'micro' || props.layout === 'strip') return 0
  return tier.value === 'wide' ? 140 : 65
})

const colLabH = computed(() => tier.value === 'micro' ? 0 : 16)

const colCount = computed(() => {
  if (!activeSeries.value.length) return 1
  return Math.max(1, (activeSeries.value[0].items || []).length)
})

const cellW = computed(() => {
  const cols = colCount.value
  const usable = Math.max(10, width.value - labW.value - gap.value * (cols - 1))
  return usable / cols
})

const cellH = computed(() => {
  const rowsCount = Math.max(1, activeSeries.value.length)
  const usableH = Math.max(10, height.value - colLabH.value - gap.value * (rowsCount - 1))
  const calculated = usableH / rowsCount
  return props.layout === 'strip' ? Math.min(usableH, 44) : Math.min(34, calculated)
})

const colLabels = computed(() => {
  if (!hasValidData.value || !colLabH.value) return []
  const firstRow = activeSeries.value[0]?.items || []
  const cW = cellW.value
  const g = gap.value
  const startX = labW.value

  return firstRow.map((it, ci) => {
    const x = startX + ci * (cW + g)
    return {
      text: it.label || '',
      cx: x + cW / 2,
      w: cW + g
    }
  })
})

const rows = computed(() => {
  if (!hasValidData.value) return []
  const hi = peakVal.value
  const cW = cellW.value
  const cH = cellH.value
  const g = gap.value
  const startX = labW.value
  const startY = colLabH.value

  return activeSeries.value.map((r, ri) => {
    const y = startY + ri * (cH + g)
    const cells = (r.items || []).map((it, ci) => {
      const val = Number(it.value) || 0
      const ratio = Math.min(1, Math.max(0, val / hi))
      const opacity = 0.12 + ratio * 0.88
      const x = startX + ci * (cW + g)
      const showNumber = cW > 28 && cH > 18 && tier.value !== 'micro'
      const textColor = opacity > 0.55 ? 'var(--aql-widget-on-fill)' : 'var(--aql-widget-ink-2)'

      return {
        value: val,
        x,
        w: cW,
        opacity,
        showNumber,
        textColor
      }
    })

    return {
      rowLabel: r.name || '',
      y,
      cellH: cH,
      cells
    }
  })
})
</script>
