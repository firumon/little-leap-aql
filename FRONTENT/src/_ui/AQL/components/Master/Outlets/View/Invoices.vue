<template>
  <StreamCard
    :title="finalTitle"
    :items="invoiceRows"
    :list="list"
    empty-title="No invoices"
    empty-text="Nothing has been billed to this outlet yet."
    empty-icon="receipt_long"
  />
</template>

<script setup>
/**
 * Outlets › View › Invoices — Section (tier CP: resource + page).
 *
 * What this outlet has been billed, newest first, and what is still owed on each document.
 *
 * ── THE CHIP IS THE BALANCE, NOT THE TOTAL ──
 * On an outlet's page the question is "how much of this is still outstanding", and a chip
 * showing the invoice total would read as money owed on every settled document. The balance
 * comes from `OutletPayments`' own allocation domain — what an invoice is worth after tax and
 * discount, and what counts as a payment against it, are accounting decisions owned by the
 * resources that make them (§3.2).
 *
 * Red only when the invoice is actually still open. Colouring every balance red would make a
 * fully-paid history indistinguishable from a debt.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import StreamCard from './StreamCard.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewInvoices', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Invoices' }
})

const { evaluate, invoiceRows, money, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))

const list = computed(() => ({
  itemKey: 'code',
  layout: ['label', 'caption', 'caption'],
  content: [
    (row) => row.code,
    (row) => [row.date, row.dueDate ? `due ${row.dueDate}` : ''].filter(Boolean).join(' · '),
    (row) => `${money(row.collected)} collected of ${money(row.total)}`
  ],
  metaLayout: ['chip'],
  chip: (row) => money(row.balance),
  chipColor: (row) => (row.isOpen && row.balance > 0.01 ? 'negative' : 'positive'),
  chipOutline: true,
  clickable: true,
  onClick: (row) => openRecord('outlet-consumption-invoices', row?.code)
}))
</script>
