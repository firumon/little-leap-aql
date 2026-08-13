<template>
  <!-- Strict hide rule: a funnel with no segments, or one whose segments all count
       zero, has nothing to be proportional TO — a zero-width bar plus an all-zero
       legend is noise, so the whole section collapses. -->
  <div
    v-if="segments.length && total > 0"
    class="aql-funnel"
  >
    <SectionDividerLabel v-if="finalAttrs.title" :label="finalAttrs.title" />

    <div class="aql-funnel__bar row no-wrap items-stretch overflow-hidden">
      <div
        v-for="segment in segments"
        :key="segment.key"
        class="aql-funnel__segment"
        :style="{ width: `${segment.percent}%`, '--aql-funnel-color': segment.cssColor }"
      >
        <q-tooltip>{{ segment.label }}: {{ segment.count }} ({{ segment.display }})</q-tooltip>
      </div>
    </div>

    <div class="aql-funnel__legend row wrap items-center q-mt-sm">
      <div
        v-for="segment in segments"
        :key="`legend-${segment.key}`"
        class="aql-funnel__legend-item row no-wrap items-center"
        :style="{ '--aql-funnel-color': segment.cssColor }"
      >
        <q-icon
          v-if="segment.icon"
          :name="segment.icon"
          size="16px"
          class="aql-funnel__legend-icon"
        />
        <span v-else class="aql-funnel__legend-dot" />
        <span class="aql-funnel__legend-label ellipsis">{{ segment.label }}</span>
        <span class="aql-funnel__legend-count text-weight-bold">{{ segment.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Workflow funnel — one proportional stacked bar across a workflow's states, with a
 * legend naming each one.
 *
 * Answers "where is the work sitting?" in a single glance, which a row of independent
 * counters cannot: the point of the stacked bar is that each state is read RELATIVE to
 * the others, so a pile-up at one stage is visible as a shape rather than as a number
 * the reader has to compare by hand.
 *
 * Entirely state-agnostic. The states, their order, their colours and their counts all
 * arrive as `items`, so this renders an approval workflow, a delivery workflow or a
 * production workflow without knowing which — the projection from records to counts is
 * the calling resource's job (see `_ui/AQL/components/Operation/OutletRestocks/Index/
 * WorkflowFunnel.js`).
 *
 * Zero-count states are DROPPED, not rendered at 0% — an invisible segment still takes a
 * legend row, and a legend of empty states buries the ones that matter.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { resolveCssColor } from 'src/utils/colorHelpers'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'SectionsWorkflowFunnel', inheritAttrs: true })

const props = defineProps({
  // Section-level divider label rendered above the bar
  title: { type: [String, Function], default: '' },
  // [{ label, count, color, icon }] — each field may itself be a closure
  items: { type: [Array, Function], default: null }
})

// ── Contexts ──
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

// $attrs is deliberately NOT spread onto the root element: Page.vue passes 20+
// pageProps (including onSubmit/onReset handlers) into every Section, and binding
// those to a plain div would register meaningless DOM listeners.
const finalAttrs = computed(() => ({
  title: evaluateProp(props.title, resourceRecord, resourceConfig) || ''
}))

function evaluate(val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

// Loose numeric coercion — sheet-backed counts arrive as strings just as often as numbers.
function toCount(val) {
  const num = Number(evaluate(val))
  return Number.isFinite(num) && num > 0 ? num : 0
}

const normalized = computed(() => {
  const resolved = evaluate(props.items)
  if (!Array.isArray(resolved)) return []

  return resolved
    .map((raw, index) => ({
      // Index is part of the key so two states sharing a label still render separately
      // rather than collapsing into one v-for slot.
      key: `${evaluate(raw?.label) ?? ''}-${index}`,
      label: evaluate(raw?.label) ?? '',
      icon: evaluate(raw?.icon) ?? '',
      count: toCount(raw?.count),
      cssColor: resolveCssColor(evaluate(raw?.color), 'var(--q-primary)')
    }))
    .filter((segment) => segment.count > 0)
})

const total = computed(() => normalized.value.reduce((sum, segment) => sum + segment.count, 0))

const segments = computed(() => {
  const sum = total.value
  if (!sum) return []
  return normalized.value.map((segment) => {
    const percent = (segment.count / sum) * 100
    return {
      ...segment,
      percent,
      // One decimal at most — `1 / 3` is 33.3%, never 33.33333.
      display: `${Math.round(percent * 10) / 10}%`
    }
  })
})
</script>
