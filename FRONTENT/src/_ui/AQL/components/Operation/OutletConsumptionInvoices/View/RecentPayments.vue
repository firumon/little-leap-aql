<template>
  <div v-if="rows.length" :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <AqlList
      :items="rows"
      item-key="key"
      :item-bordered="true"
      :layout="['label', 'caption']"
      :content="content"
      :meta-layout="['chip']"
      :chip="amountOf"
      chip-color="positive"
      chip-outline
    />
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › RecentPayments — Section (tier CP: resource + page).
 *
 * What this OUTLET has paid lately, across all of its invoices — distinct from the
 * `InvoicePayments` section above, which shows only what was paid against THIS invoice.
 *
 * The two answer different questions and both matter: an outlet that has paid nothing on this
 * invoice but settled three others last week is in a different position from one that has
 * gone quiet altogether, and only this section can tell them apart.
 *
 * A FLAT LIST rather than the collapsed accordion this used to live in — see
 * `OtherInvoices.vue` for why. Hides entirely when the outlet has no payment history.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/abstract/List.vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewRecentPayments', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Recent Payments' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, outletPayments, money } = useInvoiceViewContext()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const rows = computed(() => outletPayments.value.map((payment) => {
  const mode = String(payment.Mode || 'Other').trim()
  const reference = String(payment.Reference || '').trim()
  return {
    key: payment.Code,
    date: String(payment.Date || '').trim(),
    // Which invoice it settled, and how it was paid — the two facts that make a past payment
    // identifiable when an outlet queries it.
    detail: [payment.invoiceCode, mode, reference].filter(Boolean).join(' · '),
    amount: Number(payment.Amount) || 0
  }
}))

const content = [
  (row) => row.date,
  (row) => row.detail
]

const amountOf = (row) => money(row.amount)
</script>
