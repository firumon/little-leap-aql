<template>
  <StreamCard
    :title="finalTitle"
    :items="restocks"
    :list="list"
    :padding="padding"
    empty-title="No restocks raised"
    empty-text="No stock has ever been requested for this outlet."
    empty-icon="inventory_2"
  />
</template>

<script setup>
/**
 * Outlets › View › Restocks — Section (tier CP: resource + page).
 *
 * Every restock request raised for this outlet, newest first, with its position in the
 * approval-to-delivery workflow. The chip is painted by `OutletRestocks`' own vocabulary, so
 * "Partially Delivered" reads identically here and on the restock module's own queue (§4.5).
 *
 * The caption names WHO asked, because on an outlet's page the interesting axis is the
 * relationship rather than the document — and `RequestedUser` stores a readable name rather
 * than a user code, so it is safe to surface (§7.2).
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

defineOptions({ name: 'OutletsViewRestocks', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Restocks' },
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

const { evaluate, restocks, restockMeta, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const text = (value) => (value == null ? '' : String(value).trim())

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption'],
  content: [
    (row) => text(row.Date) || 'No date set',
    (row) => [text(row.Code), text(row.RequestedUser)].filter(Boolean).join(' · ')
  ],
  metaLayout: ['chip'],
  chip: (row) => restockMeta(row).label,
  chipColor: (row) => restockMeta(row).color,
  clickable: true,
  onClick: (row) => openRecord('outlet-restocks', row?.Code)
}))
</script>
