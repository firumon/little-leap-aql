<template>
  <AppList
    v-bind="preset"
    @click="openOutlet($event?.code)"
  />
</template>

<script setup>
/**
 * Outlets › "All Outlets" — runtime list view.
 *
 * The reference list: every active outlet, alphabetically, with its overall activity age.
 * The other five pills are narrowings of this one; it exists so a reader can find a named
 * outlet without first guessing which queue it fell into.
 *
 * The rows are narrowed by whatever is typed into `FilterInput`: this view renders Layer 2
 * summaries rather than the resolver's records, so the framework's own search never reaches
 * them and the view applies the same relayed term itself.
 *
 * The chip measures OVERALL activity — the latest event across all five streams — so a busy
 * outlet reads "Today" here whichever stream it was busy in.
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

defineOptions({ name: 'OutletsListAllOutlets', inheritAttrs: false })

const { views, filterOutlets, filterTerm, openOutlet } = useOutletOverviewContext()

const preset = computed(() => outletRowPreset(filterOutlets(views.value.AllOutlets || []), {
  stream: null,
  keyword: filterTerm.value,
  emptyText: 'No outlets on the books yet.',
  emptyIcon: 'storefront'
}))
</script>
