<template>
  <!-- Strict hide rule: nothing renders unless one item carries a label or a figure. -->
  <div v-if="items.length" class="aql-linear-progress">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <LinearProgressWidget :items="items" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import LinearProgressWidget from 'components/_dashboard_widgets/LinearProgress.vue'

defineOptions({ name: 'SectionsLinearProgress', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  // [{ label, value, max, color, unit }] — each field may itself be a closure.
  items: { type: [Array, Function], default: null },
  // Single-item fallback, used only when `items` resolves empty.
  label: { type: [String, Function], default: '' },
  value: { type: [Number, String, Function], default: null },
  max: { type: [Number, String, Function], default: null },
  color: { type: [String, Function], default: 'primary' },
  unit: { type: [String, Function], default: '' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const evaluate = (val) => evaluateProp(val, resourceRecord, resourceConfig)

const resolvedTitle = computed(() => evaluate(props.title) || '')

function isPresent (val) {
  return val !== null && val !== undefined && val !== ''
}

function resolve (raw) {
  return {
    label: evaluate(raw?.label) ?? '',
    value: evaluate(raw?.value),
    max: evaluate(raw?.max),
    unit: evaluate(raw?.unit),
    color: evaluate(raw?.color)
  }
}

function hasContent (item) {
  return isPresent(item.value) || isPresent(item.max) || !!item.label
}

const items = computed(() => {
  const resolved = evaluate(props.items)
  if (Array.isArray(resolved) && resolved.length) {
    return resolved.map(resolve).filter(hasContent)
  }

  const single = resolve({
    label: props.label,
    value: props.value,
    max: props.max,
    unit: props.unit,
    color: props.color
  })
  return hasContent(single) ? [single] : []
})
</script>
