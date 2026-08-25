<template>
  <MetricCards title="Pendings" :items="items" />
</template>

<script setup>
/**
 * Outlets › Operation Hub › PendingMetrics — Section (tier CP: resource + page).
 *
 * The three queues that need someone to go and clear them, counted in OUTLETS rather than
 * documents: an outlet with four consumptions waiting to be invoiced is one place someone
 * has to deal with, not four.
 *
 * ── NO `unit` STRINGS ──
 * Label and number only. The document counts ("19 requests", "3 consumptions") used to sit
 * beside each figure and did more harm than good: three cards each carrying two numbers in
 * two different units reads as six figures, and the reader has to work out which of each
 * pair is the one being counted. The document count is one tap away on the owning resource's
 * own queue, where it is the primary figure rather than a footnote.
 *
 * ── WHY A `.vue` SHELL AND NOT A SECOND `MetricCards.js` ──
 * A placeholder identity resolves exactly once per page, and this page needs three
 * separately-titled metric rows. So each row claims its own section NAME and delegates to
 * the framework `MetricCards` base, which already owns the grid, the colour resolution, the
 * divider and the strict hide rule (UI_MODULE_DEVELOPER_GUIDE.md §9.2). Nothing about the
 * widget is reinvented here — this file supplies a name and an `items` array.
 *
 * The base hides the whole row when every card is zero, so a tenant with a clear board sees
 * no Pendings heading at all rather than three reassuring noughts.
 *
 * Sections render outside `AqlContentWrapper`, so the card self-guards on `pending` (§9.1) —
 * the counts come from resources this route does not fetch, and a zero read before they land
 * is not the same statement as a zero read after.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useOutletOverviewContext } from 'src/_ui/AQL/composables/Master/Outlets/useOutletOverviewContext'

defineOptions({ name: 'OutletsOperationHubPendingMetrics', inheritAttrs: false })

const { pending, pendings } = useOutletOverviewContext()

const items = computed(() => {
  if (pending.value) return []

  const queues = pendings.value
  if (!queues.restockOutlets && !queues.deliveryOutlets && !queues.invoiceOutlets) return []

  return [
    {
      label: 'Restocks to approve',
      number: queues.restockOutlets,
      color: queues.restockOutlets > 0 ? 'orange' : 'grey-6'
    },
    {
      label: 'Awaiting delivery',
      number: queues.deliveryOutlets,
      color: queues.deliveryOutlets > 0 ? 'teal-7' : 'grey-6'
    },
    {
      label: 'To invoice',
      number: queues.invoiceOutlets,
      color: queues.invoiceOutlets > 0 ? 'negative' : 'grey-6'
    }
  ]
})
</script>
