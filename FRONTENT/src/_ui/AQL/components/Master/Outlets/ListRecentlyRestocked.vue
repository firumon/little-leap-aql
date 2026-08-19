<template>
  <AppList
    v-bind="preset"
    @click="openOutlet($event?.code)"
  />
</template>

<script setup>
/**
 * Outlets › "Recently Restocked" — runtime list view.
 *
 * Outlets that received a restock request inside the activity window — where stock has been
 * going. The chip measures the RESTOCK stream specifically, so an outlet that was visited
 * yesterday but last restocked a month ago reads honestly as a month here.
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

defineOptions({ name: 'OutletsListRecentlyRestocked', inheritAttrs: false })

const { views, filterOutlets, filterTerm, openOutlet } = useOutletOverviewContext()

const preset = computed(() => outletRowPreset(filterOutlets(views.value.RecentlyRestocked || []), {
  stream: 'restock',
  keyword: filterTerm.value,
  emptyText: 'No outlet has been restocked in this window.',
  emptyIcon: 'inventory_2'
}))
</script>
