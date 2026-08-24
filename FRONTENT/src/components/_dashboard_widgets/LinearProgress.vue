<template>
  <div v-if="bars.length" class="aql-linear-progress__row row items-stretch">
    <div
      v-for="(bar, index) in bars"
      :key="`${bar.label}-${index}`"
      class="aql-linear-progress__card col-12 col-sm relative-position overflow-hidden"
      :style="{ '--aql-progress-color': bar.cssColor }"
    >
      <div class="row no-wrap items-center justify-between">
        <span v-if="bar.label" class="aql-linear-progress__label ellipsis text-uppercase">{{ bar.label }}</span>
        <span v-if="bar.display" class="aql-linear-progress__percent text-weight-bold">{{ bar.display }}</span>
      </div>

      <q-linear-progress
        class="aql-linear-progress__bar q-mt-sm"
        :value="bar.ratio"
        size="10px"
        rounded
      />

      <div
        v-if="bar.leftValue || bar.rightMax"
        class="aql-linear-progress__sub row no-wrap items-center justify-between text-caption q-mt-xs"
      >
        <span v-if="bar.leftValue" class="aql-linear-progress__val ellipsis text-weight-medium">{{ bar.leftValue }}</span>
        <span v-else />
        <span v-if="bar.rightMax" class="aql-linear-progress__max ellipsis text-weight-medium">{{ bar.rightMax }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolveCssColor } from 'src/utils/colorHelpers'

defineOptions({ name: 'DashboardWidgetLinearProgress', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] }
})

function isPresent (val) {
  return val !== null && val !== undefined && val !== ''
}

function toNumber (val) {
  if (!isPresent(val)) return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

function clampPercent (num) {
  return Math.min(100, Math.max(0, num))
}

// A `max` works as a denominator only when it is a positive number; 0, blank and
// garbage all fall through to reading `value` as a percentage.
function usableMax (max) {
  const scale = toNumber(max)
  return scale !== null && scale > 0 ? scale : null
}

function resolvePercent (value, max) {
  const amount = toNumber(value)
  if (amount === null) return null
  const scale = usableMax(max)
  if (scale !== null) return clampPercent((amount / scale) * 100)
  return clampPercent(amount > 0 && amount <= 1 ? amount * 100 : amount)
}

function leftReadout (value, max, unit, pct) {
  if (!isPresent(value)) return null
  if (usableMax(max) !== null || unit) return `${value} ${unit ?? ''}`.trim()
  return pct === null ? `${value}` : `${pct}%`
}

function rightReadout (max, unit) {
  return usableMax(max) === null ? null : `${max} ${unit ?? ''}`.trim()
}

function normalize (raw) {
  const { label, value, max, unit, color } = raw ?? {}
  const percent = resolvePercent(value, max)
  const pct = percent === null ? null : Math.round(percent * 10) / 10

  return {
    label: label ?? '',
    hasInputs: isPresent(value) || isPresent(max),
    display: pct === null ? '' : `${pct}%`,
    ratio: pct === null ? 0 : pct / 100,
    leftValue: leftReadout(value, max, unit, pct),
    rightMax: rightReadout(max, unit),
    cssColor: resolveCssColor(color, 'var(--q-primary)')
  }
}

const bars = computed(() =>
  (Array.isArray(props.items) ? props.items : [])
    .map(normalize)
    .filter((bar) => bar.hasInputs || !!bar.label))
</script>
