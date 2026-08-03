<template>
  <!-- Nothing renders unless at least one valid progress item survived normalization -->
  <div
    v-if="progressItems.length"
    class="aql-linear-progress"
  >
    <SectionDividerLabel v-if="finalAttrs.title" :label="finalAttrs.title" />

    <div class="aql-linear-progress__row row items-stretch q-px-sm">
      <div
        v-for="(item, index) in progressItems"
        :key="`${item.label}-${index}`"
        class="aql-linear-progress__card col-12 col-sm relative-position overflow-hidden"
        :style="{ '--aql-progress-color': item.cssColor }"
      >
        <div class="row no-wrap items-center justify-between">
          <span v-if="item.label" class="aql-linear-progress__label ellipsis text-uppercase">{{ item.label }}</span>
          <span v-if="item.display" class="aql-linear-progress__percent text-weight-bold">{{ item.display }}</span>
        </div>

        <q-linear-progress
          class="aql-linear-progress__bar q-mt-sm"
          :value="item.ratio"
          size="10px"
          rounded
        />

        <!-- `v-else` placeholder keeps `max` hard right when there is no left readout -->
        <div
          v-if="item.leftValue || item.rightMax"
          class="aql-linear-progress__sub row no-wrap items-center justify-between text-caption q-mt-xs"
        >
          <span v-if="item.leftValue" class="aql-linear-progress__val ellipsis text-weight-medium">{{ item.leftValue }}</span>
          <span v-else />
          <span v-if="item.rightMax" class="aql-linear-progress__max ellipsis text-weight-medium">{{ item.rightMax }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { resolveCssColor } from 'src/utils/colorHelpers'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'SectionsLinearProgress', inheritAttrs: false })

const props = defineProps({
  // Section-level divider label rendered above the progress row
  title:   { type: [String, Function],         default: '' },
  // Array form: [{ label, value, max, color, unit }] — each field may itself be a closure
  items: { type: [Array, Function],          default: null },
  // Single-item fallback form, used only when `items` resolves empty
  label: { type: [String, Function],         default: '' },
  value: { type: [Number, String, Function], default: null },
  max:   { type: [Number, String, Function], default: null },
  color: { type: [String, Function],         default: 'primary' },
  unit:  { type: [String, Function],         default: '' },
})

// ── Contexts ──
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState      = inject('pageState', null)

// $attrs is deliberately NOT spread onto the root element: Page.vue passes 20+
// pageProps (including onSubmit/onReset handlers) into every Section, and binding
// those to a plain div would register meaningless DOM listeners.
const finalAttrs = computed(() => ({
  title: evaluateProp(props.title, resourceRecord, resourceConfig) || '',
}))

// ── Normalization ──
//
// A progress item is meaningful only if it carries a label or one of the two
// numeric inputs; anything else is dropped so an empty/partial config collapses
// the whole section (strict hide rule).
function evaluate(val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

function isPresent(val) {
  return val !== null && val !== undefined && val !== ''
}

// Loose numeric coercion — sheet-backed counts arrive as strings just as often as numbers.
function toNumber(val) {
  if (!isPresent(val)) return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

function clampPercent(num) {
  return Math.min(100, Math.max(0, num))
}

// A `max` is only usable as a denominator when it coerces to a positive number;
// `0`, blank and garbage all fall through to the percentage reading of `value`.
function usableMax(max) {
  const scale = toNumber(max)
  return scale !== null && scale > 0 ? scale : null
}

// `max` decides how `value` is read: with a usable `max` it is a count to divide,
// without one it is already a percentage — where a figure in (0..1] is taken as a
// fraction and scaled up. Everything lands clamped to 0..100.
function resolvePercent({ value, max }) {
  const amount = toNumber(value)
  if (amount === null) return null

  const scale = usableMax(max)
  if (scale !== null) {
    return clampPercent((amount / scale) * 100)
  }
  return clampPercent(amount > 0 && amount <= 1 ? amount * 100 : amount)
}

function normalize(raw) {
  const label = evaluate(raw?.label)
  const value = evaluate(raw?.value)
  const max   = evaluate(raw?.max)
  const unit  = evaluate(raw?.unit)
  const color = evaluate(raw?.color)

  const percent = resolvePercent({ value, max })
  // One decimal at most — `14 / 25` is 56%, `1 / 3` is 33.3%, never 33.33333.
  const pct     = percent === null ? null : Math.round(percent * 10) / 10

  return {
    label:     label ?? '',
    hasInputs: isPresent(value) || isPresent(max),
    display:   pct === null ? '' : `${pct}%`,
    ratio:     pct === null ? 0 : pct / 100,
    leftValue: leftReadout({ value, max, unit, pct }),
    rightMax:  rightReadout({ max, unit }),
    cssColor:  resolveCssColor(color, 'var(--q-primary)')
  }
}

// Below-bar left readout — the progress figure. With a usable `max` the value is a
// count to print as-is (`14 visits`, or bare `14`).
//
// Without a `max` the value is itself a percentage, and the unit decides how it
// reads: a named unit keeps the raw figure (`56 visits`), while an unnamed one
// falls back to `%` — and there it prints the *resolved* `pct`, not the raw value,
// because `resolvePercent` scales `(0..1]` and clamps above 100. `value: 0.72`
// fills the bar to 72%, so a raw `0.72%` would label it with a number it is not
// showing. The `%` also attaches directly rather than through the space-joined
// path, so it reads `56%`, never `56 %`.
function leftReadout({ value, max, unit, pct }) {
  if (!isPresent(value)) return null
  if (usableMax(max) !== null || unit) return `${value} ${unit ?? ''}`.trim()
  return pct === null ? `${value}` : `${pct}%`
}

// Below-bar right readout — the target the bar is filling towards. Gated on a
// *usable* max: `max: 0` and garbage are read as "no denominator" by
// `resolvePercent`, so captioning them as a target would contradict the bar.
function rightReadout({ max, unit }) {
  return usableMax(max) === null ? null : `${max} ${unit ?? ''}`.trim()
}

function hasContent(item) {
  return item.hasInputs || !!item.label
}

const progressItems = computed(() => {
  const resolvedItems = evaluate(props.items)
  if (Array.isArray(resolvedItems) && resolvedItems.length) {
    return resolvedItems.map(normalize).filter(hasContent)
  }

  // Single-item fallback — only materializes when a label or a numeric input is supplied
  const single = normalize({
    label: props.label,
    value: props.value,
    max:   props.max,
    unit:  props.unit,
    color: props.color
  })
  return hasContent(single) ? [single] : []
})
</script>
