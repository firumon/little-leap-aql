<template>
  <DistributionBars
    :title="title"
    :items="items"
    :max-bars="5"
    :card-class="ui.cardClass"
    :row-stagger-ms="ui.rowStaggerMs"
  />
</template>

<script setup>
import { computed } from 'vue'
import DistributionBars from 'components/sections/DistributionBars.vue'
import { useConsumptionVolumeContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionVolumeContext'

defineOptions({ name: 'OutletConsumptionsIndexConsumptionVolume', inheritAttrs: false })

const { ui, pending, topItems, topOutlets, windowDays } = useConsumptionVolumeContext()

const title = computed(() => `Consumption Volume (Last ${windowDays} Days)`)

const items = computed(() => {
  if (pending.value) return []
  if (!topItems.value.length && !topOutlets.value.length) return []

  return [
    { key: 'items', label: 'Top Items', items: topItems.value },
    { key: 'outlets', label: 'Top Outlets', items: topOutlets.value }
  ]
})
</script>
