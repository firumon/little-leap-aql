<template>
  <DistributionBars
    title="Location Coverage"
    :card-class="ui.cardClass"
    :row-stagger-ms="ui.rowStaggerMs"
    :items="items"
  />
</template>

<script setup>
import { computed } from 'vue'
import DistributionBars from 'components/sections/DistributionBars.vue'
import { useLeadIndexContext } from 'src/_ui/AQL/composables/Master/Leads/Index/useLeadIndexContext'

defineOptions({ name: 'LeadsIndexLocationCoverage', inheritAttrs: false })

const { index, ui } = useLeadIndexContext()

// Province leads because it is the coarsest and so the one that always has bars. The
// base drops any group whose bars are all empty, so an unfilled level gets no tab.
const items = computed(() => {
  const { province, city, area } = index.geography.value
  if (!province.length && !city.length && !area.length) return []

  return [
    { key: 'province', label: 'Province', items: province },
    { key: 'city', label: 'City', items: city },
    { key: 'area', label: 'Area', items: area }
  ]
})
</script>
