<template>
  <AgeingBuckets title="This Month's Outcomes" :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import AgeingBuckets from 'components/sections/AgeingBuckets.vue'
import { useLeadIndexContext } from 'src/_ui/AQL/composables/Master/Leads/Index/useLeadIndexContext'

defineOptions({ name: 'LeadsIndexMonthlyOutcomes', inheritAttrs: false })

const { index } = useLeadIndexContext()

// A fixed three-outcome scale, so a zero tile is kept and dimmed by the base. The
// base still hides the row when the month settled nothing at all.
const items = computed(() => index.monthOutcomes.value.map((entry) => ({
  label: entry.outcome,
  count: entry.count,
  color: entry.color,
  caption: 'this month'
})))
</script>
