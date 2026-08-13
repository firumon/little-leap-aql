<template>
  <SectionDividerLabel v-if="readyToDeliver.length" label="Ready to Deliver" />

  <AppList
    v-if="readyToDeliver.length"
    v-bind="rowProps"
    :items="readyToDeliver"
    highlight-color="primary"
  >
    <template #btn="{ item }">
      <RestockActionButtons :item="item" />
    </template>
  </AppList>

  <SectionDividerLabel v-if="inProgress.length" label="Partially Delivered — In Progress" />

  <AppList
    v-if="inProgress.length"
    v-bind="rowProps"
    :items="inProgress"
    highlight-color="info"
  >
    <template #btn="{ item }">
      <RestockActionButtons :item="item" />
    </template>
  </AppList>

  <!-- One empty state for the whole view rather than one per group: two "nothing here"
       cards stacked would read as two failures instead of one clear queue. -->
  <AppList
    v-if="!readyToDeliver.length && !inProgress.length"
    :items="[]"
    empty-text="Nothing awaiting delivery."
  />
</template>

<script setup>
/**
 * OutletRestocks › Index › "Pending Completion" — the combined fulfilment queue.
 *
 * APPROVED and PARTIALLY_DELIVERED are one job to the person doing it: stock has been
 * committed and has not reached the outlet yet. Splitting them across two pills made the
 * fulfilment user check two lists to answer one question, so the list view unions them
 * (`Progress in [APPROVED, PARTIALLY_DELIVERED]` in `GAS/syncAppResources.gs`) and this
 * override restores the distinction where it actually matters — as a divider, not a tab.
 *
 * Order within the view is a work order, not a grouping preference: everything READY TO
 * DELIVER comes first, oldest approval first, then the partial deliveries already under
 * way, oldest first. A brand-new approval outranks a partial from this morning because
 * the partial has at least been touched.
 *
 * This is a `.vue` override rather than a `.js` modifier because two lists with a divider
 * between them is a TEMPLATE, and a modifier can only return props. Row presentation
 * still comes from `pendingCompletionPreset`, the same bag `PropsListPendingCompletion`
 * hands the default list, so a row reads identically whichever path renders it.
 */
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import RestockActionButtons from './RestockActionButtons.vue'
import {
  pendingCompletionPreset,
  sortByDate,
  settledAt,
  isApproved,
  isPartiallyDelivered
} from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockProgress'

defineOptions({ name: 'OutletRestocksListPendingCompletion', inheritAttrs: false })

// The list content receives the ACTIVE view's records (search term + list-view tokens
// already applied) — never re-read the unfiltered resourceRecord rows.
const props = defineProps({
  items: { type: Array, default: () => [] }
})

const attrs = useAttrs()

// `items` arrives as a declared prop from the resolver's final bag, but a `.vue` override
// is also mounted with the drilled attrs, and which of the two carries the rows depends
// on how far up the chain they were set. Reading both is what `ListToday.vue` does.
const incoming = computed(() => (props.items?.length ? props.items : (attrs.items || [])))

// Oldest first in both groups: the longest-committed stock is the most overdue.
//
// Sorted through `settledAt` rather than on the bare stamp column, so a row whose stamp
// was never written still ages into position instead of sinking to the bottom of its
// group while displaying a large age — see `awaitingApprovalPreset`.
const readyToDeliver = computed(() =>
  sortByDate(incoming.value.filter(isApproved), settledAt, 'asc')
)

const inProgress = computed(() =>
  sortByDate(incoming.value.filter(isPartiallyDelivered), settledAt, 'asc')
)

/**
 * Row presentation, shared by both groups.
 *
 * `items` is stripped: each list is bound its OWN already-sorted group above, and the
 * preset's copy is the unsplit union. Keeping it would have `v-bind` re-bind every row
 * to both lists.
 *
 * The preset's state chip is stripped too. It exists so the DEFAULT list — one flat,
 * mixed list — can tell the two states apart; here the divider above each group already
 * says it, and a chip repeating the heading on every row is noise. The age caption the
 * preset puts beside it is what survives, since that varies per row.
 */
const rowProps = computed(() => {
  const { items, ...rest } = pendingCompletionPreset(incoming.value)
  return { ...rest, metaLayout: ['caption'], chip: null, chipColor: null }
})
</script>
