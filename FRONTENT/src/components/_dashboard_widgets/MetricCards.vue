<template>
  <div v-if="cards.length" class="aql-metrics__row row wrap items-stretch">
    <div
      v-for="(card, index) in cards"
      :key="`${card.label}-${index}`"
      class="aql-metrics__card relative-position overflow-hidden"
      :class="colClassFor(index, cards.length)"
      :style="{ '--aql-metric-color': card.cssColor }"
    >
      <div class="aql-metrics__value row no-wrap items-baseline">
        <span class="aql-metrics__number text-weight-bold">{{ card.number }}</span>
        <span v-if="card.unit" class="aql-metrics__unit">{{ card.unit }}</span>
      </div>
      <div v-if="card.label" class="aql-metrics__label text-uppercase">{{ card.label }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolveCssColor } from 'src/utils/colorHelpers'

defineOptions({ name: 'DashboardWidgetMetricCards', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] }
})

function hasContent (card) {
  return (card.number !== null && card.number !== undefined && card.number !== '') || !!card.label
}

const cards = computed(() =>
  (Array.isArray(props.items) ? props.items : [])
    .map((raw) => ({
      label: raw?.label ?? '',
      number: raw?.number ?? '',
      unit: raw?.unit ?? '',
      cssColor: resolveCssColor(raw?.color, 'var(--q-primary)')
    }))
    .filter(hasContent))

// Widths are chosen per COUNT so the last line is never a lonely stub — four cards
// read as 2x2 rather than 3+1, and five as 3+2.
const COL_SPANS = {
  1: () => 'col-12',
  2: () => 'col-6',
  3: () => 'col-4',
  4: () => 'col-6',
  5: (index) => (index < 3 ? 'col-4' : 'col-6')
}

function colClassFor (index, total) {
  const span = COL_SPANS[total]
  return span ? span(index) : 'col-4'
}
</script>
