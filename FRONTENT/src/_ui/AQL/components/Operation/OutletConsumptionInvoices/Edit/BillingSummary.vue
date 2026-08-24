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

const grandTotal = computed(() => header.value.Total)
const issuedTotal = computed(() => netPayableOf(record.value || {}))

const delta = computed(() => grandTotal.value - issuedTotal.value)

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
