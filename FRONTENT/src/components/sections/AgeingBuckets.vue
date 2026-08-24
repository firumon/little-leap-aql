<template>
  <!-- Strict hide rule: with nothing ageing there is no backlog to triage, and a row of
       four zeroes reads as a problem where there is none. -->
  <div v-if="items.length && total > 0" class="aql-ageing">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <AgeingBucketsWidget :items="items" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AgeingBucketsWidget from 'components/_dashboard_widgets/AgeingBuckets.vue'

defineOptions({ name: 'SectionsAgeingBuckets', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  // [{ label, count, color, caption }] — each field may itself be a closure.
  items: { type: [Array, Function], default: null }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const evaluate = (val) => evaluateProp(val, resourceRecord, resourceConfig)

const resolvedTitle = computed(() => evaluate(props.title) || '')

function toCount (val) {
  const num = Number(evaluate(val))
  return Number.isFinite(num) && num > 0 ? num : 0
}

const items = computed(() => {
  const resolved = evaluate(props.items)
  if (!Array.isArray(resolved)) return []

  return resolved
    .map((raw) => ({
      label: evaluate(raw?.label) ?? '',
      caption: evaluate(raw?.caption) ?? '',
      count: toCount(raw?.count),
      color: evaluate(raw?.color)
    }))
    .filter((bucket) => !!bucket.label)
})

const total = computed(() => items.value.reduce((sum, bucket) => sum + bucket.count, 0))
</script>
