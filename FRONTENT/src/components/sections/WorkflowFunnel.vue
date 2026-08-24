<template>
  <!-- Strict hide rule: a funnel with no segments has nothing to be proportional TO. -->
  <div v-if="items.length && total > 0" class="aql-funnel">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <WorkflowFunnelWidget :items="items" />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import WorkflowFunnelWidget from 'components/_dashboard_widgets/WorkflowFunnel.vue'

defineOptions({ name: 'SectionsWorkflowFunnel', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  // [{ label, count, color, icon }] — each field may itself be a closure.
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
      icon: evaluate(raw?.icon) ?? '',
      count: toCount(raw?.count),
      color: evaluate(raw?.color)
    }))
    .filter((segment) => segment.count > 0)
})

const total = computed(() => items.value.reduce((sum, segment) => sum + segment.count, 0))
</script>
