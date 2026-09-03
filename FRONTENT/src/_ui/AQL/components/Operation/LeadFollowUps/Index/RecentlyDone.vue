<template>
  <MetricCards :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useFollowUpIndexContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/Index/useFollowUpIndexContext'

defineOptions({ name: 'LeadFollowUpsIndexRecentlyDone', inheritAttrs: false })

const { index, progress } = useFollowUpIndexContext()

const items = computed(() => {
  const done = index.doneLast24h.value.length
  if (!done) return []
  return [{ label: 'Done in 24 Hours', number: done, color: progress.PROGRESS_COLORS[progress.COMPLETED] }]
})
</script>
