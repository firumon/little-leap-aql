<template>
  <div ref="el" class="aql-widget aql-widget-gauge">
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
      <path
        :d="trackPath"
        class="aql-widget__track"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
      />

      <path
        v-if="valuePath"
        :d="valuePath"
        :stroke="activeColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        fill="none"
      />

      <g v-if="showNeedle">
        <path
          :d="needlePath"
          :fill="activeColor"
        />
        <circle
          :cx="cx"
          :cy="cy"
          r="5"
          :fill="activeColor"
        />
      </g>

      <text
        v-if="tier !== 'micro'"
        :x="cx"
        :y="cy + valueOffsetY"
        :font-size="valueFontSize"
        class="aql-widget__value-text"
        text-anchor="middle"
      >
        {{ formattedValue }}
      </text>

      <text
        v-if="tierAtLeast(tier, 'standard')"
        :x="cx"
        :y="cy + valueOffsetY + 18"
        font-size="12"
        class="aql-widget__sub-text"
        text-anchor="middle"
      >
        of {{ formatNumber(numMax) }}
      </text>

      <template v-if="tierAtLeast(tier, 'standard')">
        <template v-if="sweep === 'half'">
          <text
            :x="cx - r"
            :y="cy + 22"
            font-size="11"
            class="aql-widget__faint-text"
            text-anchor="middle"
          >
            0
          </text>
          <text
            :x="cx + r"
            :y="cy + 22"
            font-size="11"
            class="aql-widget__faint-text"
            text-anchor="middle"
          >
            {{ formatShort(numMax) }}
          </text>
        </template>
        <text
          v-else
          :x="cx"
          :y="cy + valueOffsetY + 34"
          font-size="12"
          :fill="activeColor"
          class="aql-widget__highlight-text"
          text-anchor="middle"
        >
          {{ Math.round(pct * 100) }}%
        </text>
      </template>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import {
  polar,
  arcPath,
  formatNumber,
  formatShort,
  tierAtLeast
} from 'src/utils/widgetGeometry.js'

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
  sweep: {
    type: String,
    default: 'half',
    validator: (v) => ['half', 'horseshoe', 'full'].includes(v)
  },
  thickness: {
    type: String,
    default: 'medium',
    validator: (v) => ['thin', 'medium', 'thick'].includes(v)
  },
  showNeedle: {
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
    default: 'speed'
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

const angles = computed(() => {
  if (props.sweep === 'full') return { a0: -90, a1: 270 }
  if (props.sweep === 'horseshoe') return { a0: 135, a1: 405 }
  return { a0: 180, a1: 360 }
})

const isCentered = computed(() => props.sweep === 'full' || props.sweep === 'horseshoe')

const r = computed(() => {
  const w = width.value
  const h = height.value
  const maxR = isCentered.value ? (h - 28) / 2 : (h - 26) * 0.82
  return Math.max(16, Math.min(w / 2 - 22, maxR))
})

const cx = computed(() => width.value / 2)
const cy = computed(() => {
  if (isCentered.value) return height.value / 2
  return height.value / 2 + r.value * 0.42
})

const strokeWidth = computed(() => {
  const rad = r.value
  if (props.thickness === 'thin') return Math.max(6, rad * 0.12)
  if (props.thickness === 'thick') return Math.max(12, rad * 0.28)
  return Math.max(9, rad * 0.2)
})

const trackPath = computed(() => {
  return arcPath(cx.value, cy.value, r.value, angles.value.a0, angles.value.a1)
})

const valuePath = computed(() => {
  if (pct.value <= 0.001) return ''
  const { a0, a1 } = angles.value
  const span = a1 - a0
  const endAngle = a0 + span * pct.value
  const safeEnd = (span === 360 && pct.value >= 0.999) ? a0 + 359.99 : endAngle
  return arcPath(cx.value, cy.value, r.value, a0, safeEnd)
})

const needlePath = computed(() => {
  const { a0, a1 } = angles.value
  const span = a1 - a0
  const ang = a0 + span * pct.value
  const tip = polar(cx.value, cy.value, r.value - strokeWidth.value / 2, ang)
  const pLeft = polar(cx.value, cy.value, 4, ang - 90)
  const pRight = polar(cx.value, cy.value, 4, ang + 90)
  const pTail = polar(cx.value, cy.value, 8, ang + 180)
  return `M${tip[0].toFixed(2)} ${tip[1].toFixed(2)}L${pRight[0].toFixed(2)} ${pRight[1].toFixed(2)}L${pTail[0].toFixed(2)} ${pTail[1].toFixed(2)}L${pLeft[0].toFixed(2)} ${pLeft[1].toFixed(2)}Z`
})

const valueFontSize = computed(() => {
  if (tier.value === 'compact') return 22
  return isCentered.value ? 28 : 32
})

const valueOffsetY = computed(() => {
  if (isCentered.value) return valueFontSize.value * 0.34
  return -12
})

const formattedValue = computed(() => formatShort(numVal.value))
</script>
