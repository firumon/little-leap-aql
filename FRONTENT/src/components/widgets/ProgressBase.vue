<template>
  <div ref="el" class="aql-widget aql-widget-progress">
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
          v-if="showTrack"
          :x="vertX"
          :y="vertY"
          :width="vertWidth"
          :height="vertHeight"
          :rx="vertRadius"
          class="aql-widget__track-bg"
        />

        <rect
          v-if="pct > 0"
          :x="vertX"
          :y="vertY + vertHeight * (1 - pct)"
          :width="vertWidth"
          :height="vertHeight * pct"
          :rx="vertRadius"
          :fill="activeColor"
        />

        <text
          v-if="tier !== 'micro'"
          :x="width / 2"
          :y="vertY + vertHeight + 20"
          font-size="14"
          class="aql-widget__value-text"
          text-anchor="middle"
        >
          {{ Math.round(pct * 100) }}%
        </text>

        <text
          v-if="tierAtLeast(tier, 'standard')"
          :x="width / 2"
          :y="vertY + vertHeight + 34"
          font-size="11"
          class="aql-widget__sub-text"
          text-anchor="middle"
        >
          {{ formatShort(numVal) }} / {{ formatShort(numMax) }}
        </text>
      </template>

      <template v-else>
        <template v-if="tier !== 'micro'">
          <text
            x="0"
            y="16"
            font-size="13"
            class="aql-widget__value-text"
          >
            {{ formatNumber(numVal) }} of {{ formatNumber(numMax) }}
          </text>
          <text
            :x="width"
            y="16"
            font-size="13"
            :fill="activeColor"
            class="aql-widget__highlight-text"
            text-anchor="end"
          >
            {{ Math.round(pct * 100) }}%
          </text>
        </template>

        <template v-if="shape === 'segmented'">
          <template v-for="seg in segments" :key="seg.i">
            <rect
              v-if="showTrack"
              :x="seg.x"
              :y="horizTop"
              :width="seg.w"
              :height="barHeight"
              rx="3"
              class="aql-widget__track-bg"
            />
            <rect
              v-if="seg.fillWidth > 0"
              :x="seg.x"
              :y="horizTop"
              :width="seg.fillWidth"
              :height="barHeight"
              rx="3"
              :fill="activeColor"
            />
          </template>
        </template>

        <template v-else>
          <rect
            v-if="showTrack"
            x="0"
            :y="horizTop"
            :width="width"
            :height="barHeight"
            :rx="horizRadius"
            class="aql-widget__track-bg"
          />
          <rect
            v-if="pct > 0"
            x="0"
            :y="horizTop"
            :width="width * pct"
            :height="barHeight"
            :rx="horizRadius"
            :fill="activeColor"
          />
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
import {
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
  orientation: {
    type: String,
    default: 'horizontal',
    validator: (v) => ['horizontal', 'vertical'].includes(v)
  },
  shape: {
    type: String,
    default: 'round',
    validator: (v) => ['round', 'flat', 'segmented'].includes(v)
  },
  showTrack: {
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
    default: 'trending_flat'
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

const barHeight = computed(() => props.shape === 'flat' ? 10 : 14)

const horizTop = computed(() => {
  if (tier.value === 'micro') return Math.max(0, (height.value - barHeight.value) / 2)
  return 26
})

const horizRadius = computed(() => {
  return props.shape === 'flat' ? 0 : barHeight.value / 2
})

const vertWidth = computed(() => Math.min(width.value * 0.5, 74))
const vertX = computed(() => (width.value - vertWidth.value) / 2)
const vertY = computed(() => 10)
const vertHeight = computed(() => {
  const bottomPad = tier.value === 'micro' ? 16 : 46
  return Math.max(10, height.value - vertY.value - bottomPad)
})
const vertRadius = computed(() => props.shape === 'flat' ? 4 : 10)

const segments = computed(() => {
  const n = 10
  const g = 4
  const w = width.value
  const sw = Math.max(2, (w - g * (n - 1)) / n)
  const done = pct.value * n
  const list = []
  for (let i = 0; i < n; i++) {
    const f = Math.max(0, Math.min(1, done - i))
    list.push({
      i,
      x: i * (sw + g),
      w: sw,
      fillWidth: sw * f
    })
  }
  return list
})
</script>
