<template>
  <!-- Strict hide rule: nothing renders unless one metric carries a number or a label. -->
  <div v-if="items.length" class="aql-metrics">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <MetricCardsWidget :items="items" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import MetricCardsWidget from 'components/_dashboard_widgets/MetricCards.vue'

defineOptions({ name: 'SectionsMetricCards', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  // [{ label, number, unit, color }] — each field may itself be a closure.
  items: { type: [Array, Function], default: null },
  // Single-metric fallback, used only when `items` resolves empty.
  label: { type: [String, Function], default: '' },
  number: { type: [Number, String, Function], default: null },
  unit: { type: [String, Function], default: '' },
  color: { type: [String, Function], default: 'primary' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const evaluate = (val) => evaluateProp(val, resourceRecord, resourceConfig)

const resolvedTitle = computed(() => evaluate(props.title) || '')

function resolve (raw) {
  return {
    label: evaluate(raw?.label) ?? '',
    number: evaluate(raw?.number) ?? '',
    unit: evaluate(raw?.unit) ?? '',
    color: evaluate(raw?.color)
  }
}

function hasContent (metric) {
  const hasNumber = metric.number !== null && metric.number !== undefined && metric.number !== ''
  return hasNumber || !!metric.label
}

const items = computed(() => {
  const resolved = evaluate(props.items)
  if (Array.isArray(resolved) && resolved.length) {
    return resolved.map(resolve).filter(hasContent)
  }

  const single = resolve({
    label: props.label,
    number: props.number,
    unit: props.unit,
    color: props.color
  })
  return hasContent(single) ? [single] : []
})
</script>
