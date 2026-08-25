<template>
  <StreamCard
    :title="finalTitle"
    :items="payments"
    :list="list"
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
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import StreamCard from './StreamCard.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewPayments', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Payments' }
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
