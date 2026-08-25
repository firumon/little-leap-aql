<template>
  <LinearProgress :items="items" />
</template>

<script setup>
/**
 * Outlets › Operation Hub › RecentUpdates — Section (tier CP: resource + page).
 *
 * One bar: how much of the estate has transacted at all inside the activity window. An
 * outlet counts as live if ANY of the five operational streams — visit, restock,
 * consumption, invoice, payment — fired for it; the rule itself is `isActiveOutlet` in the
 * domain layer, so this card and the "No Updates" pill beneath it cannot disagree about who
 * is stale.
 *
 * NO `title`. The bar names itself on the item's own `label`; a section heading above a
 * single figure reads as two headings for one number (§9.2).
 *
 * The denominator is every ACTIVE outlet on the master list, not only the ones with a
 * stream — an outlet nobody has ever touched is precisely what this ratio exists to surface.
 *
 * Hides itself when there are no outlets to measure. It does NOT hide on a zero numerator:
 * "0 of 230 active" is the single most important reading this page can produce, and a widget
 * that vanished at exactly that moment would hide the emergency.
 *
 * Sections render outside `AqlContentWrapper`, so this one self-guards on `pending` (§9.1).
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import LinearProgress from 'components/sections/LinearProgress.vue'
import { useOutletOverviewContext } from 'src/_ui/AQL/composables/Master/Outlets/useOutletOverviewContext'

defineOptions({ name: 'OutletsOperationHubRecentUpdates', inheritAttrs: false })

const { pending, activity } = useOutletOverviewContext()

const items = computed(() => {
  if (pending.value) return []

  const health = activity.value
  if (!health.total) return []

  return [
    {
      label: `Active in last ${health.windowDays} days`,
      value: health.active,
      max: health.total,
      unit: 'outlets',
      color: health.ratio >= 0.66 ? 'positive' : (health.ratio >= 0.33 ? 'orange' : 'negative')
    }
  ]
})
</script>
