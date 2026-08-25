<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card :class="ui.cardClass">
      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div v-for="line in lines" :key="line.key" class="aql-detail-line">
            <div class="aql-detail-key">{{ line.label }}</div>
            <div class="aql-detail-val" :class="line.negative ? 'text-negative' : ''">
              {{ line.negative ? '−' : '' }}{{ money(line.value) }}
            </div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="row items-center justify-between q-py-sm">
        <div class="text-subtitle2 text-weight-bold">Net Payable</div>
        <div class="text-h6 text-weight-bolder text-primary">{{ payableText }}</div>
      </q-card-section>
    </q-card>

    <!-- TAX SUMMARY — its own card, always open. It is a statement of what was charged
         under each tax code, which is what a return is filed from; folding it into an
         accordion made the invoice's most audited figures the hardest to reach. -->
    <template v-if="taxBreakdown.length">
      <SectionDividerLabel label="Tax Summary" />

      <q-card :class="ui.cardClass">
        <q-card-section class="q-py-sm">
          <div class="aql-detail-grid">
            <div v-for="entry in taxBreakdown" :key="entry.TaxCode" class="aql-detail-line">
              <div class="aql-detail-key">{{ entry.TaxCode }} on {{ money(entry.TaxableAmount) }}</div>
              <div class="aql-detail-val">{{ money(entry.TaxAmount) }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › BillingSummary — Section (tier CP: resource + page).
 *
 * How the payable was arrived at, in the order the money moves: gross value, what came off
 * it, what tax was added, what returns credited back, and the net.
 *
 * Every line is stated even at zero — Subtotal, Discount, Taxable Amount, Tax Amount, Returns
 * Credited — because this card is a reconciliation, and a reader checking why the net is what
 * it is needs to see that a component is zero, not have to infer it from a missing row. The
 * one exception is the discount's LABEL, below.
 *
 * ── WHY THE DISCOUNT LABEL CHANGES ──
 * Under `PRE_TAX` the discount has ALREADY been absorbed into every line's taxable amount, so
 * presenting it as a header deduction would show it twice and produce a summary whose lines
 * do not add up to its own total. `invoicePolicyOf` is what knows which case this invoice is
 * in — the same function `netPayableOf` uses to decide whether to subtract it — so the
 * display and the arithmetic agree by construction.
 *
 * The tax summary is one line PER TAX CODE, read from the header's stored `TaxDetails`. A
 * compound tax contributes one line per component, because that is the granularity it was
 * calculated at and the granularity a return needs.
 *
 * No `<style>` block; `.aql-detail-*` are the canonical shared classes (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewBillingSummary', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Billing Summary' }
})

const { evaluate, ui, record, taxBreakdown, policy, payableText, money } = useInvoiceViewContext()

const finalTitle = computed(() => evaluate(props.title))

const num = (value) => Number(value) || 0

const lines = computed(() => {
  const entry = record.value || {}
  const preTax = policy.value.discountTaxPolicy === 'PRE_TAX'

  return [
    { key: 'subtotal', label: 'Subtotal', value: num(entry.Subtotal) },
    {
      key: 'discount',
      // See the PRE_TAX note in the header block above.
      label: preTax ? 'Discount (applied to line items)' : 'Discount',
      value: num(entry.Discount),
      negative: num(entry.Discount) > 0
    },
    { key: 'taxable', label: 'Taxable Amount', value: num(entry.TotalTaxableAmount) },
    { key: 'tax', label: 'Tax Amount', value: num(entry.TotalTaxAmount) },
    {
      key: 'returns',
      label: 'Returns Credited',
      value: num(entry.ReturnDeductionTotal),
      negative: num(entry.ReturnDeductionTotal) > 0
    }
  ]
})
</script>
