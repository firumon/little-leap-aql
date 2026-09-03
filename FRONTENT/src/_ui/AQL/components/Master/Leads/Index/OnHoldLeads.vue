<template>
  <MetricCards :items="items" />
</template>

<script setup>
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useLeadIndexContext } from 'src/_ui/AQL/composables/Master/Leads/Index/useLeadIndexContext'

defineOptions({ name: 'LeadsIndexOnHoldLeads', inheritAttrs: false })

const { index, progress } = useLeadIndexContext()

const items = computed(() => {
  const count = index.onHoldLeads.value.length
  if (!count) return []
  return [{ label: 'On Hold', number: count, color: progress.PROGRESS_COLORS[progress.LATER] }]
})
</script>
