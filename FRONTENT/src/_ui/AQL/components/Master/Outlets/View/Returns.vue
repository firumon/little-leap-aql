<template>
  <StreamCard
    :title="finalTitle"
    :items="returns"
    :list="list"
    :padding="padding"
    empty-title="No returns"
    empty-text="Nothing has been sent back from this outlet."
    empty-icon="assignment_turned_in"
  />
</template>

<script setup>
/**
 * Outlets › View › Returns — Section (tier CP: resource + page).
 *
 * Stock sent back from this outlet, newest first. The caption leads with the REASON rather
 * than the document code: a return's reason is the fact a reader of an outlet's page is
 * actually after, and the code tells them nothing they can act on.
 *
 * `OutletReturns` carries no shared workflow vocabulary module of its own yet, so the chip
 * states the quantity — a value the row genuinely owns — rather than inventing a second,
 * unshared colour map for its `Progress` column. Inventing one here is exactly the per-page
 * copy §4.5 forbids; when that resource gains a vocabulary file, this chip switches to it.
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

defineOptions({ name: 'OutletsViewReturns', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Returns' },
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

const { evaluate, returns, skuLabelOf, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption', 'caption'],
  content: [
    (row) => skuLabelOf(row.SKU).primary,
    (row) => text(row.Reason) || 'No reason recorded',
    (row) => [text(row.Date), text(row.Username)].filter(Boolean).join(' · ')
  ],
  metaLayout: ['chip'],
  chip: (row) => `${num(row.Qty)} ${skuLabelOf(row.SKU).uom}`,
  chipColor: 'grey-7',
  chipOutline: true,
  clickable: true,
  onClick: (row) => openRecord('outlet-returns', row?.Code)
}))
</script>
