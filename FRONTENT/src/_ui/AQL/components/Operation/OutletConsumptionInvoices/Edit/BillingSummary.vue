<template>
  <div :class="gutterClass">
    <SectionDividerLabel label="BILLING SUMMARY" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div v-for="line in summary" :key="line.key" class="aql-detail-line">
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
        <div class="text-h6 text-weight-bolder text-primary">{{ money(grandTotal) }}</div>
      </q-card-section>

      <!-- The MOVEMENT, not just the new figure. A user correcting one price on a
           forty-line invoice needs to see what their change did to the payable; the new
           total alone does not say. Shown only once something has actually moved. -->
      <template v-if="moved">
        <q-separator />
        <q-card-section class="row items-center justify-between q-py-sm">
          <div class="text-caption text-grey-8">Was {{ money(issuedTotal) }}</div>
          <q-chip dense square outline :color="delta > 0 ? 'orange-9' : 'positive'" class="q-my-none">
            {{ delta > 0 ? '+' : '−' }}{{ money(Math.abs(delta)) }}
          </q-chip>
        </q-card-section>
      </template>
    </q-card>

    <template v-if="taxBreakdown.length">
      <SectionDividerLabel label="TAX SUMMARY" />

      <q-card flat bordered :class="ui.cardClass">
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
 * OutletConsumptionInvoices › Edit › BillingSummary — what the edit now comes to.
 *
 * Every figure comes from ONE call to the shared engine, held on the page context — the same
 * object `Edit/PageAction.js` submits. That is why the engine takes a price resolver rather
 * than pre-priced lines: a price corrected two cards up re-runs line tax and apportionment
 * together, so the total on screen is not an approximation of what will be written, it IS
 * what will be written.
 *
 * Every component is stated even at zero, because this card is a reconciliation and a reader
 * checking why the payable is what it is needs to see a zero rather than infer it from a
 * missing row.
 *
 * ── WHY THE DISCOUNT LABEL CHANGES ──
 * Under `PRE_TAX` the discount has ALREADY been absorbed into every line's taxable amount, so
 * presenting it as a header deduction would show it twice and produce a summary whose lines
 * do not add up to its own total. The policy comes from the same call that did the
 * arithmetic, so the display and the figures agree by construction.
 *
 * The "was" line compares against the payable STORED on the row, read through `grandTotalOf`
 * — the one function that owns that formula, so the comparison cannot drift from what the
 * View page shows.
 *
 * No `<style>` block; `.aql-detail-*` are the canonical shared classes (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { netPayableOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { useInvoiceEditContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Edit/useInvoiceEditContext'

defineOptions({ name: 'OutletConsumptionInvoicesEditBillingSummary', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, money, record, invoice } = useInvoiceEditContext()

const header = computed(() => invoice.value.header)
const taxBreakdown = computed(() => invoice.value.taxBreakdown)

/**
 * EXACT, on both sides — no rounding interval anywhere on this card.
 *
 * This is a DATA-ENTRY page. The figure the user is building has to be the one their own
 * lines add up to, or they cannot check their own work; a settlement number they have no way
 * to influence is noise while they are still typing. The `exact (rounded)` pair belongs on
 * the View and payment surfaces, where somebody reconciles the bill or collects against it
 * — see `payableLabel` in Layer 2 for the rule and why it is split this way.
 *
 * The "was" figure is the exact stored payable for the same reason: comparing an exact new
 * total against a rounded old one would report a difference the edit did not make.
 */
const grandTotal = computed(() => header.value.Total)
const issuedTotal = computed(() => netPayableOf(record.value || {}))

const delta = computed(() => grandTotal.value - issuedTotal.value)

// Float noise is not a change anybody made, and would show a "+0.00" chip on an invoice
// nobody has touched.
const moved = computed(() => Math.abs(delta.value) >= 0.005)

const summary = computed(() => {
  const entry = header.value
  const preTax = invoice.value.policy.discountTaxPolicy === 'PRE_TAX'

  return [
    { key: 'subtotal', label: 'Subtotal', value: entry.Subtotal },
    {
      key: 'discount',
      label: preTax ? 'Discount (applied to line items)' : 'Discount',
      value: entry.Discount,
      negative: entry.Discount > 0
    },
    { key: 'taxable', label: 'Taxable Amount', value: entry.TotalTaxableAmount },
    { key: 'tax', label: 'Tax Amount', value: entry.TotalTaxAmount },
    {
      key: 'returns',
      label: 'Returns Credited',
      value: entry.ReturnDeductionTotal,
      negative: entry.ReturnDeductionTotal > 0
    }
  ]
})
</script>
