<template>
  <AppList
    v-bind="preset"
    @click="openOutlet($event?.code)"
  />
</template>

<script setup>
/**
 * Outlets › "No Updates" — runtime list view.
 *
 * Outlets that have gone silent across ALL FIVE streams for longer than the activity window
 * — no visit, no restock, no consumption, no invoice, no payment.
 *
 * Ordered longest-silence-first, and outlets with no recorded event AT ALL lead the queue:
 * "never" is the longest silence there is, and sorting it as a number would sink it below a
 * merely very old one.
 *
 * Empty here is GOOD NEWS, so the empty state says so rather than reading as a fault (§10.4).
 *
 * The row shape is the page's one shared preset, told which stream its trailing chip
 * measures — so this list and its five siblings state the same outlet the same way, and only
 * the age they are judging it by differs. The preset also narrows the rows by whatever is
 * typed into `FilterInput`: these views render Layer 2 summaries rather than the resolver's
 * records, so the framework's own search never reaches them and each view applies the same
 * relayed term itself.
 *
 * PLACEMENT — the RESOURCE tier (§3.1). Both the Outlets Index and `operation-hub` resolve
 * this same view from the same Layer 2 aggregate; a page-scoped copy would be two files that
 * must agree forever.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useOutletOverviewContext } from 'src/_ui/AQL/composables/Master/Outlets/useOutletOverviewContext'
import { outletRowPreset } from 'src/_ui/AQL/composables/Master/Outlets/useOutletRowPresets'

defineOptions({ name: 'OutletsListNoUpdates', inheritAttrs: false })

const { views, filterOutlets, filterTerm, openOutlet } = useOutletOverviewContext()

const preset = computed(() => outletRowPreset(filterOutlets(views.value.NoUpdates || []), {
  stream: null,
  keyword: filterTerm.value,
  emptyText: 'Every outlet has moved recently. Nothing has gone quiet.',
  emptyIcon: 'task_alt',
  emptyIconColor: 'positive'
}))
</script>
