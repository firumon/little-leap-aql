<template>
  <MetricCards :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useLeadIndexContext } from 'src/_ui/AQL/composables/Master/Leads/Index/useLeadIndexContext'

defineOptions({ name: 'LeadsIndexLiveLeads', inheritAttrs: false })

const { index, progress } = useLeadIndexContext()

// The base hides the whole row on an empty array, so nobody reads a reassuring nought.
const items = computed(() => {
  const live = index.liveLeads.value.length
  if (!live) return []
  return [{ label: 'Live Leads', number: live, color: progress.PROGRESS_COLORS[progress.PROCESSING] }]
})
</script>
