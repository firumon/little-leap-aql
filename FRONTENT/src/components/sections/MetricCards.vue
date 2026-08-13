<template>
  <!-- Nothing renders unless at least one valid metric survived normalization -->
  <div
    v-if="metrics.length"
    class="aql-metrics"
  >
    <SectionDividerLabel v-if="finalAttrs.title" :label="finalAttrs.title" />

    <div class="aql-metrics__row row wrap items-stretch">
      <div
        v-for="(metric, index) in metrics"
        :key="`${metric.label}-${index}`"
        class="aql-metrics__card relative-position overflow-hidden"
        :class="colClassFor(index, metrics.length)"
        :style="{ '--aql-metric-color': metric.cssColor }"
      >
        <div class="aql-metrics__value row no-wrap items-baseline">
          <span class="aql-metrics__number text-weight-bold">{{ metric.number }}</span>
          <span v-if="metric.unit" class="aql-metrics__unit">{{ metric.unit }}</span>
        </div>
        <!-- Wraps rather than ellipses: the row is now a grid (three cards fit a phone
             at `col-4`), and "PENDING C…" is not a metric anyone can read. -->
        <div v-if="metric.label" class="aql-metrics__label text-uppercase">{{ metric.label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { resolveCssColor } from 'src/utils/colorHelpers'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'SectionsMetricCards', inheritAttrs: true })

const props = defineProps({
  // Section-level divider label rendered above the metrics row
  title:  { type: [String, Function],         default: '' },
  // Array form: [{ label, number, unit, color }] — each field may itself be a closure
  items:  { type: [Array, Function],          default: null },
  // Single-metric fallback form, used only when `items` resolves empty
  label:  { type: [String, Function],         default: '' },
  number: { type: [Number, String, Function], default: null },
  unit:   { type: [String, Function],         default: '' },
  color:  { type: [String, Function],         default: 'primary' },
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
// A metric is meaningful only if it carries a number or a label; anything else is
// dropped so an empty/partial config collapses the whole section (strict hide rule).
function evaluate(val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

function hasContent(metric) {
  const hasNumber = metric.number !== null && metric.number !== undefined && metric.number !== ''
  return hasNumber || !!metric.label
}

function normalize(raw) {
  const label  = evaluate(raw?.label)
  const number = evaluate(raw?.number)
  const unit   = evaluate(raw?.unit)
  const color  = evaluate(raw?.color)

  return {
    label:    label  ?? '',
    number:   number ?? '',
    unit:     unit   ?? '',
    cssColor: resolveCssColor(color, 'var(--q-primary)')
  }
}

const metrics = computed(() => {
  const resolvedItems = evaluate(props.items)
  if (Array.isArray(resolvedItems) && resolvedItems.length) {
    return resolvedItems.map(normalize).filter(hasContent)
  }

  // Single-item fallback — only materializes when number or label is supplied
  const single = normalize({
    label:  props.label,
    number: props.number,
    unit:   props.unit,
    color:  props.color
  })
  return hasContent(single) ? [single] : []
})

// ── Responsive grid ──
//
// The row WRAPS rather than scrolling horizontally: an off-screen metric is a metric
// nobody reads, and a card cluster is a summary, not a list. Widths are chosen per
// COUNT so the last line is never a lonely stub — four cards read as 2×2 rather than
// 3+1, and five as 3+2 rather than 3+1+1.
//
// The `col-*` classes are Quasar's, but the gap between cards is this section's own
// (`.aql-metrics__row`), so `custom.scss` narrows each width by its share of that gap —
// a bare `col-6` plus a gap would overflow the row.
const COL_SPANS = {
  1: () => 'col-12',
  2: () => 'col-6',
  3: () => 'col-4',
  4: () => 'col-6',
  5: (index) => (index < 3 ? 'col-4' : 'col-6')
}

function colClassFor(index, total) {
  const span = COL_SPANS[total]
  // Six or more: a uniform three-per-row grid, which divides evenly for 6, 9, 12 and
  // leaves at worst a two-card final line.
  return span ? span(index) : 'col-4'
}
</script>
