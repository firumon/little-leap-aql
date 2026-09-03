<template>
  <Gauge :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import Gauge from 'components/sections/Gauge.vue'
import { useFollowUpIndexContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/Index/useFollowUpIndexContext'

defineOptions({ name: 'LeadFollowUpsIndexScheduledCoverage', inheritAttrs: false })

const { index } = useFollowUpIndexContext()

// A past-due booking still counts as covered: the lead HAS a plan, it is just late,
// and saying so is the Overdue card's job, not this one's.
const items = computed(() => {
  const { covered, total } = index.scheduledCoverage.value
  // No Processing lead means no denominator, so there is no ratio to draw.
  if (!total) return []

  return [{
    label: 'Scheduled Coverage',
    caption: `${covered} of ${total} processing leads booked`,
    value: covered,
    max: total,
    color: covered >= total ? 'positive' : (covered > 0 ? 'primary' : 'warning')
  }]
})
</script>
