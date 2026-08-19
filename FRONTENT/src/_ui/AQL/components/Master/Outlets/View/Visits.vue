<template>
  <StreamCard
    :title="finalTitle"
    :items="visits"
    :list="list"
    :padding="padding"
    empty-title="No visits recorded"
    empty-text="Nobody has been scheduled to this outlet yet."
    empty-icon="event_busy"
  />
</template>

<script setup>
/**
 * Outlets › View › Visits — Section (tier CP: resource + page).
 *
 * This outlet's visit history and its forward book, newest first, painted from
 * `OutletVisits`' own workflow vocabulary — so a PLANNED visit here carries the same colour
 * it carries on the Visits module's own list (§4.5).
 *
 * The card reports; it does not offer to plan one. The Plan Visit entry point lives in the
 * Action subsystem, which owns its permission gate.
 *
 * ── SPACING COMES FROM THE PAGE, THROUGH THE `padding` PROP ──
 * `Page.vue` puts `q-px-{pageProps.sectionPadding}` on the placeholder AND passes the same
 * token as a `:padding` prop. Only the prop reaches this component: `inheritAttrs: false`
 * (§12.1, mandatory on the leaf the resolver mounts) drops the class along with the rest of
 * `$attrs`. So the inset is applied from the declared prop — the sanctioned channel for a
 * section's horizontal inset (§7.5, §10.2). Vertical rhythm stays the page body's gutter.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import StreamCard from './StreamCard.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewVisits', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Visits' },
  // Horizontal inset, supplied by `Page.vue` as `:padding="pageProps.sectionPadding"`.
  //
  // Needed because this component sets `inheritAttrs: false` (§12.1 — it is the leaf the
  // resolver mounts), which DROPS the `q-px-{sectionPadding}` class `Page.vue` also puts on
  // the placeholder. The framework passes the same token as a real PROP for exactly this
  // case: a declared `padding` prop is the sanctioned channel for a section's horizontal
  // inset (§7.5, §10.2) and the only one that survives a leaf. Vertical rhythm still belongs
  // to the page body's gutter.
  padding: { type: String, default: 'sm' }
})

const { evaluate, visits, visitMeta, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const text = (value) => (value == null ? '' : String(value).trim())

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption'],
  content: [
    (row) => text(row.Date) || 'No date set',
    // The visit's own comment for the state it is in — the reviewer's words, resolved by the
    // visit domain rather than guessed at from a column name here.
    (row) => text(row.ProgressPlannedComment || row.ProgressCompletedComment ||
      row.ProgressPostponedComment || row.ProgressCancelledComment) || text(row.Code)
  ],
  metaLayout: ['chip'],
  chip: (row) => visitMeta(row).label,
  chipColor: (row) => visitMeta(row).color,
  clickable: true,
  onClick: (row) => openRecord('outlet-visits', row?.Code)
}))
</script>
