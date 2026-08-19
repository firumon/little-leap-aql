<template>
  <AppList
    v-bind="preset"
    @click="openOutlet($event?.code)"
  />
</template>

<script setup>
/**
 * Outlets › "Recently Paid" — runtime list view.
 *
 * Outlets that paid inside the activity window — where money is coming back. This is the
 * stream that is most often the last to fire, which is why it gets a pill of its own rather
 * than being folded into general activity.
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

defineOptions({ name: 'OutletsListRecentlyPaid', inheritAttrs: false })

const { views, filterOutlets, filterTerm, openOutlet } = useOutletOverviewContext()

const preset = computed(() => outletRowPreset(filterOutlets(views.value.RecentlyPaid || []), {
  stream: 'payment',
  keyword: filterTerm.value,
  emptyText: 'No payment has been collected in this window.',
  emptyIcon: 'payments'
}))
</script>
