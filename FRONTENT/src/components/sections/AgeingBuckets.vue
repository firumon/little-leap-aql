<template>
  <!-- Strict hide rule: with nothing ageing there is no backlog to triage, and a row of
       four zeroes reads as a problem where there is none. -->
  <div
    v-if="buckets.length && total > 0"
    class="aql-ageing"
  >
    <SectionDividerLabel v-if="finalAttrs.title" :label="finalAttrs.title" />

    <div class="aql-ageing__row row wrap items-stretch">
      <div
        v-for="bucket in buckets"
        :key="bucket.key"
        class="aql-ageing__bucket col relative-position"
        :class="{ 'aql-ageing__bucket--empty': !bucket.count }"
        :style="{ '--aql-ageing-color': bucket.cssColor }"
      >
        <div class="aql-ageing__count text-weight-bold">{{ bucket.count }}</div>
        <div class="aql-ageing__label text-uppercase">{{ bucket.label }}</div>
        <div v-if="bucket.caption" class="aql-ageing__caption ellipsis">{{ bucket.caption }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Ageing buckets — how long the outstanding work has been outstanding.
 *
 * A single "12 awaiting approval" counter cannot distinguish twelve requests raised this
 * morning from twelve that have been ignored for a fortnight, and those are opposite
 * situations. Bucketing by age turns the count into a triage instruction.
 *
 * Age BANDING is the caller's decision, not this component's: the thresholds that matter
 * differ per workflow (an approval queue ages in days, a stock count in months). Buckets
 * arrive already counted, so this file owns presentation only — see
 * `_ui/AQL/components/Operation/OutletRestocks/Index/AgeingBuckets.js` for the projection.
 *
 * Empty buckets are KEPT, unlike the funnel's zero-count segments: the bands are a fixed
 * scale, and "0 in 7+ days" is the reassuring half of the reading. They are dimmed rather
 * than dropped so the scale stays intact. The section as a whole still hides when every
 * bucket is zero.
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { resolveCssColor } from 'src/utils/colorHelpers'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'SectionsAgeingBuckets', inheritAttrs: true })

const props = defineProps({
  // Section-level divider label rendered above the buckets
  title: { type: [String, Function], default: '' },
  // [{ label, count, color, caption }] — each field may itself be a closure
  items: { type: [Array, Function], default: null }
})

// ── Contexts ──
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

// $attrs is deliberately NOT spread onto the root element — see MetricCards.vue.
const finalAttrs = computed(() => ({
  title: evaluateProp(props.title, resourceRecord, resourceConfig) || ''
}))

function evaluate(val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

function toCount(val) {
  const num = Number(evaluate(val))
  return Number.isFinite(num) && num > 0 ? num : 0
}

const buckets = computed(() => {
  const resolved = evaluate(props.items)
  if (!Array.isArray(resolved)) return []

  return resolved
    .map((raw, index) => ({
      key: `${evaluate(raw?.label) ?? ''}-${index}`,
      label: evaluate(raw?.label) ?? '',
      caption: evaluate(raw?.caption) ?? '',
      count: toCount(raw?.count),
      cssColor: resolveCssColor(evaluate(raw?.color), 'var(--q-primary)')
    }))
    // A bucket with no label is not a band a reader can interpret.
    .filter((bucket) => !!bucket.label)
})

const total = computed(() => buckets.value.reduce((sum, bucket) => sum + bucket.count, 0))
</script>
