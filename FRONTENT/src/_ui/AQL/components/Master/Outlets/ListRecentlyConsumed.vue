<template>
  <AppList
    v-bind="preset"
    @click="openOutlet($event?.code)"
  />
</template>

<script setup>
/**
 * Outlets › "Recently Consumed" — runtime list view.
 *
 * Outlets whose stock was counted and sold inside the activity window — where the product is
 * actually moving off the shelf, as opposed to merely arriving on it.
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

defineOptions({ name: 'OutletsListRecentlyConsumed', inheritAttrs: false })

const { views, filterOutlets, filterTerm, openOutlet } = useOutletOverviewContext()

const preset = computed(() => outletRowPreset(filterOutlets(views.value.RecentlyConsumed || []), {
  stream: 'consumption',
  keyword: filterTerm.value,
  emptyText: 'No consumption has been counted in this window.',
  emptyIcon: 'point_of_sale'
}))
</script>
