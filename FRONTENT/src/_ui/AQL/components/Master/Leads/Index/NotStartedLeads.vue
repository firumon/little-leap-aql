<template>
  <MetricCards :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useLeadIndexContext } from 'src/_ui/AQL/composables/Master/Leads/Index/useLeadIndexContext'

defineOptions({ name: 'LeadsIndexNotStartedLeads', inheritAttrs: false })

const { index, progress } = useLeadIndexContext()

const items = computed(() => {
  const count = index.notStartedLeads.value.length
  if (!count) return []
  return [{ label: 'Not Started', number: count, color: progress.PROGRESS_COLORS[progress.DRAFT] }]
})
</script>
