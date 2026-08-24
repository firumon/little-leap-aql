<template>
  <!-- Strict hide rule: nothing renders unless a row carries a non-zero figure. -->
  <div v-if="items.length && series.length" :class="paddingClass">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <MultiSeriesBarsWidget
      :items="items"
      :series="series"
      :layout="resolvedLayout"
      :max="resolvedMax"
      :max-rows="maxRows"
      :card-class="resolvedCardClass"
      :row-stagger-ms="rowStaggerMs"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import MultiSeriesBarsWidget from 'components/_dashboard_widgets/MultiSeriesBars.vue'

defineOptions({ name: 'SectionsDualDistributionBars', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  // [{ label, values: { seriesKey: number } }] — a flat `{ label, seriesKey: n }` works too.
  items: { type: [Array, Function], default: null },
  // [{ key, label, color, trackColor }] — one bar per entry in every row.
  series: { type: [Array, Function], default: null },
  // `stacked` gives each series its own line; `inline` lays them on one track.
  layout: { type: [String, Function], default: 'stacked' },
  max: { type: [Number, String, Function], default: null },
  maxRows: { type: Number, default: 12 },
  // Empty by design: the resource's modifier relays its own `ui.cardClass`.
  cardClass: { type: [String, Array, Object, Function], default: '' },
  rowStaggerMs: { type: Number, default: 40 },
  // `inheritAttrs: false` drops Page.vue's `q-px-*`, so the inset arrives as a prop.
  padding: { type: String, default: 'sm' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const evaluate = (val) => evaluateProp(val, resourceRecord, resourceConfig)

const paddingClass = computed(() => (props.padding ? `q-px-${props.padding}` : ''))

const resolvedTitle = computed(() => evaluate(props.title) || '')
const resolvedCardClass = computed(() => evaluate(props.cardClass) || '')
const resolvedLayout = computed(() => evaluate(props.layout) || 'stacked')
const resolvedMax = computed(() => {
  const num = Number(evaluate(props.max))
  return Number.isFinite(num) && num > 0 ? num : null
})

const series = computed(() => {
  const resolved = evaluate(props.series)
  if (!Array.isArray(resolved)) return []
  return resolved
    .map((line, index) => ({
      key: String(evaluate(line?.key) ?? index),
      label: String(evaluate(line?.label) ?? ''),
      color: evaluate(line?.color) || 'primary',
      trackColor: evaluate(line?.trackColor) || 'grey-3'
    }))
    .filter((line) => !!line.key)
})

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const items = computed(() => {
  const resolved = evaluate(props.items)
  if (!Array.isArray(resolved) || !series.value.length) return []

  return resolved
    .map((raw) => {
      const values = {}
      series.value.forEach((line) => {
        values[line.key] = num(evaluate(raw?.values?.[line.key] ?? raw?.[line.key]))
      })
      return { label: String(evaluate(raw?.label) ?? '').trim(), values }
    })
    .filter((row) => row.label && series.value.some((line) => row.values[line.key] > 0))
})
</script>
