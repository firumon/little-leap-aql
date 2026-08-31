<template>
  <div v-if="visible && hasSales" :class="gutterClass">
    <SectionDividerLabel label="SOLD THIS VISIT" />
    <q-card flat bordered :class="ui.cardClass">
      <!-- bg-transparent: the card owns the surface, else its corners show a border sliver. -->
      <AqlList
        :items="lines"
        item-key="sku"
        :layout="['label', 'caption', 'caption', 'caption']"
        :content="content"
        :meta-layout="['chip']"
        :chip="(row) => `${row.qty}`"
        chip-color="primary"
        :separator="true"
        :item-bordered="false"
        item-class="bg-transparent"
        gutter="none"
      >
        <template #btn="{ item }">
          <div style="width: 96px">
            <component
              :is="CurrencyField"
              :model-value="item.price"
              :record="item"
              :config="priceConfig"
              header="Price"
              @update:model-value="(value) => setLinePrice(item.index, value)"
            />
          </div>
        </template>
      </AqlList>
    </q-card>

    <SectionDividerLabel label="INVOICING" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">Generate invoice</div>
            <div class="text-caption text-grey-8">Bill this outlet for what was sold.</div>
          </div>
          <div class="col-auto">
            <q-toggle v-model="invoicing" color="primary" />
          </div>
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none column" :class="gutterClass">
        <component
          :is="SelectField"
          v-model="priceListCode"
          :record="{}"
          :config="priceListConfig"
          header="PriceListCode"
        />
        <component
          :is="DateField"
          v-model="dueDate"
          :record="{}"
          :config="dueDateConfig"
          header="DueDate"
        />

        <!-- Plain wrapper is load-bearing: it absorbs q-col-gutter-md's -16px margin. -->
          <div class="row" :class="gutterClassColX">
            <div class="col-6">
              <component
                :is="SelectField"
                v-model="discountType"
                :record="{}"
                :config="discountTypeConfig"
                header="DiscountType"
              />
            </div>
            <div class="col-6">
              <component
                :is="NumberField"
                v-model="discountValue"
                :record="{}"
                :config="discountValueConfig"
                header="DiscountValue"
              />
            </div>
          </div>

        <component
          :is="TextareaField"
          v-model="invoiceComment"
          :record="{}"
          :config="commentConfig"
          header="InvoiceComment"
        />

        <q-separator />
        <div :class="invoicing ? '' : 'text-grey-6'">
          <div v-for="line in summaryLines" :key="line.label" class="row justify-between"
               :class="line.strong ? 'text-body2 text-weight-medium' : 'text-body2 text-grey-8'">
            <span>{{ line.label }}</span><span>{{ line.value }}</span>
          </div>
          <q-separator class="q-my-xs" />
          <div class="row justify-between text-subtitle1 text-weight-bold">
            <span>Total</span><span>{{ _C(invoiceTotal) }}</span>
          </div>
          <div class="text-caption text-grey-7 q-pt-xs">{{ policyCaption }}</div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Step 3 - what sold, and the invoice terms. Every input writes straight into the
// OutletConsumptionInvoices node; Layer 2's derive rules do the maths from there.
import { computed, defineComponent, h, inject, useAttrs, watch } from 'vue'
import { QItemLabel, QBtn } from 'quasar'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/abstract/List.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { priceOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { invoiceNodeForConsumption } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import {
  netPayableOf,
  storedTaxBreakdown,
  invoicePolicyOf
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { NODE, CTRL, INVOICING, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddSoldReview', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const DISCOUNT_TYPES = [
  { value: 'FLAT', label: 'Flat amount' },
  { value: 'PERCENT', label: 'Percentage' }
]

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const gutterClassColX = computed(() => `q-col-gutter-x-${attrs.gutter || 'sm'}`)

const ui = useAQLConfig()
const pageState = inject('pageState')
const { _C } = useCurrency()
const { activePriceLists } = usePriceListResource()
const { getSku } = useSkuResource()

const SelectField = resolveFieldComponent('select', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')
const NumberField = resolveFieldComponent('number', 'add')
const DateField = resolveFieldComponent('date', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const invoice = pageState.useNode(NODE.INVOICES)
const consumption = pageState.useNode(NODE.CONSUMPTION)

const visible = computed(() => stepVisible(pageState, props.step))

// Page-level, so turning invoicing off keeps the node and everything typed on it.
const invoicing = pageState.useControls(INVOICING, true)

// Turned back on, the invoice refills from what sold. The rebuild is
// OutletConsumptionInvoices' own rule, so the sold rows go to Layer 2 and the node comes
// back priced. Keyed on the LINES, not on the node: a disabled field on this card writes
// its control back and re-creates an empty node, and an existence test then reads that
// shell as a filled invoice.
watch([invoicing, visible, () => invoice.children(NODE.INVOICE_ITEMS).value.length],
  ([on, shown, billed]) => {
    if (on !== true || !shown || billed > 0) return
    const node = invoiceNodeForConsumption(
      consumption.node.value.record,
      consumption.children(NODE.ITEMS).value,
      { existing: invoice.node.value.record })
    if (node) pageState.setResource(NODE.INVOICES, null, node)
  }, { immediate: true })

const priceListCode = pageState.useRecord('PriceListCode', NODE.INVOICES)
const dueDate = pageState.useRecord('DueDate', NODE.INVOICES)
const discountType = pageState.useControls(CTRL.DISCOUNT_TYPE.header, 'FLAT', NODE.INVOICES)
const discountValue = pageState.useControls(CTRL.DISCOUNT_VALUE.header, 0, NODE.INVOICES)

// Not a sheet column: it becomes the invoice's progress comment, so it stays a control.
const invoiceComment = pageState.useControls(CTRL.INVOICE_COMMENT.header, '', NODE.INVOICES)

// Memoised: a fresh literal per render re-runs each field's watchers on every keystroke.
const disabled = computed(() => invoicing.value !== true)
const priceListOptions = computed(() =>
  activePriceLists.value.map((list) => ({ value: list.code, label: list.name || list.code })))

const priceConfig = computed(() => ({
  label: 'Unit price', inputClass: 'text-right text-weight-bold', disable: disabled.value
}))
const priceListConfig = computed(() => ({
  label: 'Price list', options: priceListOptions.value, clearable: false, disable: disabled.value
}))
const discountTypeConfig = computed(() => ({
  label: 'Discount type', options: DISCOUNT_TYPES, clearable: false, disable: disabled.value
}))
const discountValueConfig = computed(() => ({
  label: discountType.value === 'PERCENT' ? 'Discount %' : 'Discount amount', disable: disabled.value
}))
const dueDateConfig = computed(() => ({ label: 'Due date', disable: disabled.value }))
const commentConfig = computed(() => ({ label: 'Invoice note (optional)', disable: disabled.value }))

// ── Everything below READS the node ─────────────────────────────────────────

const header = computed(() => invoice.node.value.record)
const invoiceTotal = computed(() => netPayableOf(header.value))
const invoiceTaxBreakdown = computed(() => storedTaxBreakdown(header.value))
const invoicePolicy = computed(() => invoicePolicyOf(text(priceListCode.value)))

function skuLabel (sku) {
  const info = getSku(text(sku)) || {}
  const variants = (info.variantValues || []).filter(Boolean).join(' / ')
  return { primary: text(info.productName) || text(sku), secondary: variants || text(sku) }
}

// WHAT SOLD is the consumption's own answer, so the list is read from there. The invoice
// node is dropped whenever invoicing is off, and a list read off it would vanish with it.
const soldItems = computed(() => (consumption.children(NODE.ITEMS).value || [])
  .filter((row) => num(row.Qty) > 0))

const hasSales = computed(() => soldItems.value.length > 0)

// The billed line for a SKU, and where it sits — the address a price edit is written to.
const invoiceLineBySku = computed(() => new Map(
  (invoice.children(NODE.INVOICE_ITEMS).value || [])
    .map((row, index) => [text(row.SKU), { row, index }])))

const lines = computed(() => soldItems.value.map((item) => {
  const sku = text(item.SKU)
  const label = skuLabel(sku)
  const listed = priceOf(sku, text(priceListCode.value))
  const priced = listed !== null && listed !== undefined
  const billed = invoiceLineBySku.value.get(sku)
  const row = billed?.row || {}
  // No invoice line yet — the price list is what this would bill at.
  const price = billed ? num(row.Price) : num(listed)
  return {
    index: billed ? billed.index : -1,
    sku,
    name: label.primary,
    variant: label.secondary,
    qty: num(item.Qty),
    price,
    basePrice: num(listed),
    // Surfaced only while it would still bill at zero - typing a price answers it.
    unpriced: !priced && price <= 0,
    overridden: priced && price !== num(listed),
    total: billed ? num(row.Total) : price * num(item.Qty),
    tax: num(row.TaxAmount)
  }
}))

const setLinePrice = (index, value) => {
  if (index < 0) return
  pageState.setChildren(NODE.INVOICE_ITEMS, index, 'Price', num(value), NODE.INVOICES)
}

const lineCaption = (line) => {
  if (line.unpriced) return 'Not in this price list — set a unit price to bill it'
  const base = _C(line.total)
  // The line's own tax, stated on the line that generated it.
  return line.tax > 0 ? `${base} · tax ${_C(line.tax)}` : base
}

const LineValueNote = defineComponent({
  name: 'SoldLineValueNote',
  props: { item: { type: Object, required: true } },
  setup: (props) => () => h(QItemLabel, {
    caption: true,
    class: props.item.unpriced ? 'text-negative' : 'text-grey-8'
  }, () => lineCaption(props.item))
})

const RepricedNote = defineComponent({
  name: 'SoldLineRepricedNote',
  props: { item: { type: Object, required: true } },
  setup: (props) => () => {
    const row = props.item
    if (!row.overridden) return null
    return h(QItemLabel, { caption: true, class: 'text-orange-9' }, () => [
      `was ${_C(row.basePrice)} `,
      h(QBtn, {
        flat: true,
        dense: true,
        noCaps: true,
        size: 'sm',
        color: 'primary',
        label: 'Restore',
        disable: disabled.value,
        class: 'q-ml-xs q-px-xs',
        'aria-label': `Restore the price list price for ${row.name}`,
        onClick: () => setLinePrice(row.index, row.basePrice)
      })
    ])
  }
})

const content = [
  (row) => row.name,
  (row) => row.variant,
  LineValueNote,
  RepricedNote
]

const summaryLines = computed(() => {
  const row = header.value
  const rows = [
    { label: 'Subtotal', value: _C(row.Subtotal), amount: row.Subtotal, strong: true },
    { label: 'Discount', value: `− ${_C(row.Discount)}`, amount: row.Discount },
    { label: 'Taxable amount', value: _C(row.TotalTaxableAmount), amount: row.TotalTaxableAmount },
    // One row per TAX CODE. A compound tax lands as its components, which is the
    // granularity the invoice stores and a tax return is filed at.
    ...invoiceTaxBreakdown.value.map((entry) => ({
      label: entry.TaxCode,
      value: _C(entry.TaxAmount),
      amount: entry.TaxAmount
    })),
    { label: 'Tax', value: _C(row.TotalTaxAmount), amount: row.TotalTaxAmount, strong: true },
    { label: 'Returns credited', value: `− ${_C(row.ReturnDeductionTotal)}`, amount: row.ReturnDeductionTotal }
  ]
  return rows.filter((entry) => Number(entry.amount) > 0)
})

const policyCaption = computed(() => {
  const { discountTaxPolicy, taxInclusive } = invoicePolicy.value
  const discountRule = discountTaxPolicy === 'PRE_TAX'
    ? 'Discount is applied before tax'
    : 'Tax is charged on the full value, then the discount is applied'
  return `${discountRule}. Prices ${taxInclusive ? 'include' : 'exclude'} tax.`
})
</script>
