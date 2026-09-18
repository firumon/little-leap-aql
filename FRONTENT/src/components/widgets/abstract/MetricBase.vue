<template>
  <div ref="el" class="aql-widget aql-widget-metric">
    <div v-if="!hasValidData" class="aql-widget-empty">
      <slot name="empty">
        <q-icon :name="emptyIcon" size="28px" :color="emptyIconColor" />
        <div class="aql-widget-empty__text">
          <Renderable :value="emptyText" />
        </div>
      </slot>
    </div>

    <div
      v-else
      class="aql-widget-metric__content"
      :class="{ 'text-center items-center': tier === 'micro' }"
    >
      <div
        class="aql-widget-metric__value"
        :style="{ fontSize: valueFontSize }"
      >
        <Renderable :value="displayValue" />
      </div>

      <div v-if="tier !== 'micro'" class="aql-widget-metric__footer">
        <span
          class="aql-widget-metric__badge"
          :style="{
            color: badgeTone,
            backgroundColor: badgeBg
          }"
        >
          <svg
            v-if="showArrow"
            viewBox="0 0 10 10"
            class="aql-widget-metric__badge-icon"
            fill="currentColor"
          >
            <path v-if="isUp" d="M 1 7 L 5 2 L 9 7 Z" />
            <path v-else d="M 1 3 L 5 8 L 9 3 Z" />
          </svg>
          <Renderable :value="displayDelta" />
        </span>

        <span
          v-if="tierAtLeast(tier, 'standard') && hasCompare"
          class="aql-widget-metric__caption"
        >
          <Renderable :value="displayCaption" />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import {
  signed,
  formatNumber,
  formatValue,
  tierAtLeast
} from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  value: {
    type: [Number, String, Function, Object],
    default: null
  },
  valueFormat: {
    type: Function,
    default: null
  },
  compare: {
    type: [Number, String],
    default: null
  },
  deltaLabel: {
    type: [String, Function, Object],
    default: null
  },
  caption: {
    type: [String, Function, Object],
    default: null
  },
  arrowStyle: {
    type: String,
    default: 'angled',
    validator: (v) => ['angled', 'vertical', 'none'].includes(v)
  },
  badgeShape: {
    type: String,
    default: 'pill',
    validator: (v) => ['pill', 'ghost'].includes(v)
  },
  sentiment: {
    type: String,
    default: 'auto',
    validator: (v) => ['auto', 'neutral'].includes(v)
  },
  invert: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'numbers'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, tier } = useWidgetTier()

const numVal = computed(() => {
  if (typeof props.value === 'number') return props.value
  const parsed = Number(props.value)
  return isNaN(parsed) ? null : parsed
})

const numCompare = computed(() => {
  if (props.compare === null || props.compare === undefined || props.compare === '') return null
  const parsed = Number(props.compare)
  return isNaN(parsed) ? null : parsed
})

const hasValidData = computed(() => {
  return props.value !== null &&
    props.value !== undefined &&
    props.value !== '' &&
    (typeof props.value === 'object' || typeof props.value === 'function' || numVal.value !== null)
})

const hasCompare = computed(() => {
  return numCompare.value !== null && numCompare.value !== 0
})

const isNew = computed(() => !hasCompare.value)

const delta = computed(() => {
  if (!hasCompare.value || numVal.value === null) return 0
  return (numVal.value - numCompare.value) / Math.abs(numCompare.value)
})

const pctString = computed(() => {
  return Math.abs(delta.value * 100).toFixed(1) + '%'
})

const isZero = computed(() => {
  return hasCompare.value && (pctString.value === '0.0%' || Math.abs(delta.value * 100) < 0.05)
})

const isUp = computed(() => delta.value > 0)

const isGood = computed(() => {
  return props.invert ? !isUp.value : isUp.value
})

const badgeTone = computed(() => {
  if (isNew.value) return 'var(--q-info)'
  if (isZero.value || props.sentiment === 'neutral') return 'var(--aql-widget-ink-2)'
  return isGood.value ? 'var(--q-positive)' : 'var(--q-negative)'
})

const badgeBg = computed(() => {
  return `color-mix(in srgb, ${badgeTone.value} 14%, transparent)`
})

const showArrow = computed(() => {
  if (props.arrowStyle === 'none' || isNew.value || isZero.value) return false
  return true
})

const calculatedDeltaLabel = computed(() => {
  if (isNew.value) return 'NEW'
  if (isZero.value) return '0.0%'
  return (isUp.value ? '+' : '−') + pctString.value
})

const displayValue = computed(() => {
  if (numVal.value !== null) return formatValue(numVal.value, props.valueFormat, signed(numVal.value))
  return props.value
})

const displayDelta = computed(() => {
  if (props.deltaLabel !== null && props.deltaLabel !== undefined) return props.deltaLabel
  return calculatedDeltaLabel.value
})

const displayCaption = computed(() => {
  if (props.caption !== null && props.caption !== undefined) return props.caption
  if (hasCompare.value) return `vs ${formatNumber(numCompare.value)} last period`
  return ''
})

const valueFontSize = computed(() => {
  if (tier.value === 'micro') return '22px'
  if (tier.value === 'compact') return '28px'
  return '34px'
})
</script>
