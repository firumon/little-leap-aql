<template>
  <div ref="el" class="aql-widget aql-widget-bullet">
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
        <rect
          v-for="(z, i) in computedZones"
          :key="i"
          :x="vertX"
          :y="z.y"
          :width="vertWidth"
          :height="z.h"
          :fill="z.fill"
          :opacity="zoneOpacity"
        />

        <rect
          :x="vertBarX"
          :y="vertBarY"
          :width="vertBarWidth"
          :height="vertBarHeight"
          rx="2"
          :fill="activeColor"
        />

        <template v-if="markerShape === 'triangle'">
          <path
            :d="`M ${vertX - 5} ${vertTargetY - 4} L ${vertX} ${vertTargetY} L ${vertX - 5} ${vertTargetY + 4} Z`"
            class="aql-widget__value-text"
          />
          <path
            :d="`M ${vertX + vertWidth + 5} ${vertTargetY - 4} L ${vertX + vertWidth} ${vertTargetY} L ${vertX + vertWidth + 5} ${vertTargetY + 4} Z`"
            class="aql-widget__value-text"
          />
        </template>
        <line
          v-else
          :x1="vertX - 4"
          :y1="vertTargetY"
          :x2="vertX + vertWidth + 4"
          :y2="vertTargetY"
          class="aql-widget__bullet-target"
        />

        <text
          v-if="tier !== 'micro'"
          :x="width / 2"
          :y="vertBaseY + 20"
          font-size="12"
          class="aql-widget__value-text"
          text-anchor="middle"
        >
          {{ formatNumber(numVal) }} / {{ formatNumber(numTarget) }}
        </text>
      </template>

      <template v-else>
        <template v-if="tier !== 'micro'">
          <text
            x="0"
            y="14"
            font-size="14"
            class="aql-widget__value-text"
          >
            {{ formatNumber(numVal) }}
          </text>
          <text
            :x="width"
            y="14"
            font-size="11"
            class="aql-widget__sub-text"
            text-anchor="end"
          >
            target {{ formatNumber(numTarget) }}
          </text>
        </template>

        <rect
          v-for="(z, i) in computedZones"
          :key="i"
          :x="z.x"
          :y="horizTop"
          :width="z.w"
          :height="horizHeight"
          :fill="z.fill"
          :opacity="zoneOpacity"
        />

        <rect
          :x="0"
          :y="horizBarY"
          :width="horizBarWidth"
          :height="horizBarHeight"
          rx="2"
          :fill="activeColor"
        />

        <template v-if="markerShape === 'triangle'">
          <path
            :d="`M ${horizTargetX - 4} ${horizTop - 5} L ${horizTargetX} ${horizTop} L ${horizTargetX + 4} ${horizTop - 5} Z`"
            class="aql-widget__value-text"
          />
          <path
            :d="`M ${horizTargetX - 4} ${horizTop + horizHeight + 5} L ${horizTargetX} ${horizTop + horizHeight} L ${horizTargetX + 4} ${horizTop + horizHeight + 5} Z`"
            class="aql-widget__value-text"
          />
        </template>
        <line
          v-else
          :x1="horizTargetX"
          :y1="horizTop - 4"
          :x2="horizTargetX"
          :y2="horizTop + horizHeight + 4"
          class="aql-widget__bullet-target"
        />

        <template v-if="tier === 'wide'">
          <text
            v-for="(z, i) in computedZones"
            :key="`lbl-${i}`"
            :x="z.x + z.w / 2"
            :y="horizTop + horizHeight + 15"
            font-size="10"
            class="aql-widget__faint-text"
            text-anchor="middle"
          >
            {{ formatShort(z.upTo) }}
          </text>
        </template>
      </template>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import { formatNumber, formatShort } from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  value: {
    type: [Number, String],
    default: null
  },
  target: {
    type: [Number, String],
    default: null
  },
  max: {
    type: [Number, String],
    default: null
  },
  zones: {
    type: Array,
    default: () => []
  },
  orientation: {
    type: String,
    default: 'horizontal',
    validator: (v) => ['horizontal', 'vertical'].includes(v)
  },
  zoneStyle: {
    type: String,
    default: 'muted',
    validator: (v) => ['muted', 'contrast'].includes(v)
  },
  markerShape: {
    type: String,
    default: 'line',
    validator: (v) => ['line', 'triangle'].includes(v)
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
    default: 'adjust'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, width, height, tier } = useWidgetTier()

const numVal = computed(() => Number(props.value))
const numTarget = computed(() => Number(props.target ?? 0))
const numMax = computed(() => Number(props.max))

const hasValidData = computed(() => {
  return numMax.value > 0 &&
    props.value !== null &&
    props.value !== undefined &&
    !isNaN(numVal.value) &&
    !isNaN(numMax.value)
})

const activeColor = computed(() => resolveCssColor(props.color))
const zoneOpacity = computed(() => props.zoneStyle === 'contrast' ? 0.28 : 0.16)

const vertWidth = computed(() => 46)
const vertX = computed(() => (width.value - vertWidth.value) / 2)
const vertY = computed(() => 14)
const vertPlotH = computed(() => {
  const bottomPad = tier.value === 'micro' ? 16 : 44
  return Math.max(10, height.value - vertY.value - bottomPad)
})
const vertBaseY = computed(() => vertY.value + vertPlotH.value)

const vertScale = (n) => {
  if (numMax.value <= 0) return 0
  return Math.min(vertPlotH.value, Math.max(0, (n / numMax.value) * vertPlotH.value))
}

const vertBarWidth = computed(() => vertWidth.value * 0.44)
const vertBarX = computed(() => vertX.value + vertWidth.value * 0.28)
const vertBarHeight = computed(() => vertScale(numVal.value))
const vertBarY = computed(() => vertBaseY.value - vertBarHeight.value)
const vertTargetY = computed(() => vertBaseY.value - vertScale(numTarget.value))

const horizHeight = computed(() => 22)
const horizTop = computed(() => tier.value === 'micro' ? Math.max(0, (height.value - horizHeight.value) / 2) : 24)

const horizScale = (n) => {
  if (numMax.value <= 0) return 0
  return Math.min(width.value, Math.max(0, (n / numMax.value) * width.value))
}

const horizBarHeight = computed(() => horizHeight.value * 0.44)
const horizBarY = computed(() => horizTop.value + horizHeight.value * 0.28)
const horizBarWidth = computed(() => horizScale(numVal.value))
const horizTargetX = computed(() => horizScale(numTarget.value))

const computedZones = computed(() => {
  const list = props.zones || []
  let prev = 0
  return list.map((z) => {
    const fill = resolveCssColor(z.color || 'primary')
    if (props.orientation === 'vertical') {
      const s0 = vertScale(prev)
      const s1 = vertScale(z.upTo)
      prev = z.upTo
      return {
        y: vertBaseY.value - s1,
        h: Math.max(0, s1 - s0),
        fill,
        upTo: z.upTo
      }
    }
    const s0 = horizScale(prev)
    const s1 = horizScale(z.upTo)
    prev = z.upTo
    return {
      x: s0,
      w: Math.max(0, s1 - s0),
      fill,
      upTo: z.upTo
    }
  })
})
</script>
