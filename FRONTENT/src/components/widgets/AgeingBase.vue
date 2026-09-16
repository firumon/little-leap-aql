<template>
  <div ref="el" class="aql-widget aql-widget-ageing">
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
      <g v-for="(b, bi) in buckets" :key="bi">
        <rect
          :x="b.x"
          :y="b.y"
          :width="b.w"
          :height="b.h"
          :rx="bucketStyle === 'blocks' ? 4 : 0"
          :fill="b.color"
        />

        <template v-if="tier !== 'micro'">
          <text
            :x="bi === 0 && buckets.length > 1 ? b.x + 2 : bi === buckets.length - 1 && buckets.length > 1 ? b.x + b.w - 2 : b.cx"
            :y="b.y - 6"
            font-size="11"
            class="aql-widget__value-text"
            :text-anchor="bi === 0 && buckets.length > 1 ? 'start' : bi === buckets.length - 1 && buckets.length > 1 ? 'end' : 'middle'"
          >
            {{ formatShort(b.value) }}
          </text>
          <text
            :x="bi === 0 && buckets.length > 1 ? b.x + 2 : bi === buckets.length - 1 && buckets.length > 1 ? b.x + b.w - 2 : b.cx"
            :y="plotBottom + 16"
            font-size="10"
            class="aql-widget__sub-text"
            :text-anchor="bi === 0 && buckets.length > 1 ? 'start' : bi === buckets.length - 1 && buckets.length > 1 ? 'end' : 'middle'"
          >
            {{ truncate(b.label, Math.max(10, b.w - 2), 10) }}
          </text>
        </template>
      </g>

      <line
        v-if="showBaseline"
        :x1="0"
        :y1="plotBottom"
        :x2="width"
        :y2="plotBottom"
        class="aql-widget__axis-line"
      />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { formatShort, truncate } from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  bucketStyle: {
    type: String,
    default: 'blocks',
    validator: (v) => ['blocks', 'staircase'].includes(v)
  },
  dangerTint: {
    type: String,
    default: 'escalating',
    validator: (v) => ['last-only', 'escalating'].includes(v)
  },
  showBaseline: {
    type: Boolean,
    default: true
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'hourglass_empty'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()

const ESCALATING_RAMP = [
  'var(--q-primary)',
  'var(--q-info)',
  'var(--q-warning)',
  'color-mix(in srgb, var(--q-negative) 70%, var(--q-warning))',
  'var(--q-negative)'
]

const hasValidData = computed(() => {
  const list = props.items || []
  if (!list.length) return false
  const values = list.map((i) => Number(i.value))
  return values.every((v) => !isNaN(v) && v >= 0) && Math.max(...values) > 0
})

const hi = computed(() => {
  if (!hasValidData.value) return 1
  return Math.max(1, ...props.items.map((i) => Number(i.value) || 0))
})

const plotTop = computed(() => tier.value === 'micro' ? 6 : 18)
const axisH = computed(() => tier.value === 'micro' ? 6 : 30)
const plotHeight = computed(() => Math.max(10, height.value - plotTop.value - axisH.value))
const plotBottom = computed(() => plotTop.value + plotHeight.value)

function getBucketColor (index, count) {
  if (props.dangerTint === 'last-only') {
    return index === count - 1 ? 'var(--q-negative)' : 'var(--q-primary)'
  }
  if (count <= 1) return ESCALATING_RAMP[0]
  const rampIdx = Math.min(
    ESCALATING_RAMP.length - 1,
    Math.round((index / (count - 1)) * (ESCALATING_RAMP.length - 1))
  )
  return ESCALATING_RAMP[rampIdx]
}

const buckets = computed(() => {
  if (!hasValidData.value) return []
  const list = props.items
  const count = list.length
  const isStaircase = props.bucketStyle === 'staircase'
  const gap = isStaircase ? 2 : 12
  const totalGap = gap * (count - 1)
  const pad = 4
  const usableW = Math.max(10, width.value - pad * 2)
  const bw = Math.max(4, Math.floor((usableW - totalGap) / count))
  const maxVal = hi.value
  const pH = plotHeight.value
  const pBottom = plotBottom.value

  return list.map((it, i) => {
    const val = Number(it.value) || 0
    const bh = (val / maxVal) * pH
    const x = pad + i * (bw + gap)
    const y = pBottom - bh

    return {
      label: it.label || '',
      value: val,
      x,
      y,
      w: bw,
      h: bh,
      cx: x + bw / 2,
      color: getBucketColor(i, count)
    }
  })
})
</script>
