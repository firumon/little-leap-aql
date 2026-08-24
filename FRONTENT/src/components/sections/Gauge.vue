<template>
  <!-- Strict hide rule: a gauge needs a denominator, and a 0% dial on a day with nothing
       scheduled reads as a failure rather than as an empty calendar. -->
  <div v-if="items.length" class="aql-gauge">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <GaugeWidget
      :items="items"
      :size="size"
      :thickness="thickness"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps || {}" />
      </template>
    </GaugeWidget>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import GaugeWidget from 'components/_dashboard_widgets/Gauge.vue'

defineOptions({ name: 'SectionsGauge', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  // [{ label, caption, value, max, color, display }] — each field may itself be a closure.
  items: { type: [Array, Function], default: null },

  // Single-dial fallback. Slot-shaped props are widened to accept a component definition.
  label: { type: [String, Function, Object], default: '' },
  caption: { type: [String, Function, Object], default: '' },
  display: { type: [String, Function, Object], default: null },
  value: { type: [Number, String, Function], default: null },
  max: { type: [Number, String, Function], default: null },
  color: { type: [String, Function], default: 'primary' },

  size: { type: String, default: '96px' },
  thickness: { type: Number, default: 0.18 }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const evaluate = (val) => evaluateProp(val, resourceRecord, resourceConfig)

const resolvedTitle = computed(() => evaluate(props.title) || '')

// The blank check comes BEFORE Number(): coercing first would make "nothing supplied"
// indistinguishable from a real zero and defeat the hide rule.
function toNumber (val) {
  const resolved = evaluate(val)
  if (resolved === null || resolved === undefined || resolved === '') return null
  const num = Number(resolved)
  return Number.isFinite(num) ? num : null
}

function resolve (raw) {
  return {
    label: evaluate(raw?.label) ?? '',
    caption: evaluate(raw?.caption) ?? '',
    display: evaluate(raw?.display),
    value: toNumber(raw?.value),
    max: toNumber(raw?.max),
    color: evaluate(raw?.color) || 'primary'
  }
}

const items = computed(() => {
  const resolved = evaluate(props.items)
  const source = Array.isArray(resolved) && resolved.length
    ? resolved
    : [{
        label: props.label,
        caption: props.caption,
        display: props.display,
        value: props.value,
        max: props.max,
        color: props.color
      }]

  return source.map(resolve).filter((dial) => dial.value !== null)
})
</script>
