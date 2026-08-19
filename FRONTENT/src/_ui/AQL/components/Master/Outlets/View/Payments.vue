<template>
  <StreamCard
    :title="finalTitle"
    :items="payments"
    :list="list"
    :padding="padding"
    empty-title="No payments"
    empty-text="No money has been collected from this outlet yet."
    empty-icon="payments"
  />
</template>

<script setup>
/**
 * Outlets › View › Payments — Section (tier CP: resource + page).
 *
 * Money collected from this outlet, newest first: when, who took it, and how.
 *
 * NO PROGRESS CHIP on the amount. The amount is what a reader comes here for and takes the
 * chip slot; a cancelled receipt is called out in the caption instead, where it sits beside
 * the facts that explain it rather than competing with the figure (§7.2).
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

defineOptions({ name: 'OutletsViewPayments', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Payments' },
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

const { evaluate, payments, paymentMeta, money, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const text = (value) => (value == null ? '' : String(value).trim())

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption', 'caption'],
  content: [
    (row) => text(row.Date) || 'No date',
    (row) => [text(row.Mode) || 'Cash', text(row.Username)].filter(Boolean).join(' · '),
    (row) => [text(row.OutletConsumptionInvoiceCode), paymentMeta(row).label]
      .filter(Boolean).join(' · ')
  ],
  metaLayout: ['label'],
  metaLabel: (row) => money(row.Amount),
  metaColor: (row) => paymentMeta(row).color,
  clickable: true,
  onClick: (row) => openRecord('outlet-payments', row?.Code)
}))
</script>
