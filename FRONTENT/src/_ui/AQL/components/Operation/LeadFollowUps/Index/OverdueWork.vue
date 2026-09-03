<template>
  <MetricCards :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useFollowUpIndexContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/Index/useFollowUpIndexContext'

defineOptions({ name: 'LeadFollowUpsIndexOverdueWork', inheritAttrs: false })

const { index } = useFollowUpIndexContext()

// Two shapes of neglect, side by side: work whose date has passed, and work nobody has
// answered at all. A zero card is dropped, so each half hides on its own.
const items = computed(() => {
  const cards = []
  const late = index.overdueCount.value
  const quiet = index.noResponseCount.value

  if (late) cards.push({ label: 'Overdue', number: late, color: 'negative' })
  if (quiet) cards.push({ label: 'No Response', number: quiet, color: 'grey-7' })

  return cards
})
</script>
