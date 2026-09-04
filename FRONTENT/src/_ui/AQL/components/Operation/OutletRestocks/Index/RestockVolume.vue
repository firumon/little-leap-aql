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
/**
 * OutletRestocks › Index › RestockVolume — Section (tier CP: resource + page).
 *
 * What actually moved lately, read two ways: the SKUs that went out most, and the outlets
 * that took the most. Both are the same counted set of requests seen from a different
 * side, so they are ONE card with a toggle rather than two cards a reader has to compare
 * across — the grouped shape the base was built for.
 *
 * This is the only widget on the page reporting VOLUME rather than a queue, which is why
 * it sits below the ageing buckets: it is context for the work, not the work itself.
 *
 * Its own identity rather than the plain `DistributionBars` one, because a section
 * placeholder resolves exactly once per page and this page may later want a second
 * distribution card.
 *
 * The base hides itself on an empty array, so a tenant with no recent restocks sees
 * nothing here rather than an empty card.
 */
import { computed } from 'vue'
import DistributionBars from 'components/sections/DistributionBars.vue'
import { useRestockVolumeContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Index/useRestockVolumeContext'

defineOptions({ name: 'OutletRestocksIndexRestockVolume', inheritAttrs: false })

const { ui, pending, topItems, topOutlets, windowDays } = useRestockVolumeContext()

const title = computed(() => `Restock Volume (Last ${windowDays} Days)`)

const items = computed(() => {
  if (pending.value) return []
  if (!topItems.value.length && !topOutlets.value.length) return []

  return [
    { key: 'items', label: 'Top Items', items: topItems.value },
    { key: 'outlets', label: 'Top Outlets', items: topOutlets.value }
  ]
})
</script>
