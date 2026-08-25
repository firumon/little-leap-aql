<template>
  <div v-if="visible && hasSales" :class="gutterClass">
    <SectionDividerLabel label="SOLD THIS VISIT" />
    <q-card flat bordered :class="ui.cardClass">
      <!-- bg-transparent: the card owns the surface, else its corners show a border sliver. -->
      <AqlList
        :items="wizard.invoiceLines.value"
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
        <template v-if="wizard.generateInvoice.value" #btn="{ item }">
          <div style="width: 96px">
            <component
              :is="CurrencyField"
              :model-value="item.price"
              :record="item"
              :config="PRICE_CONFIG"
              header="Price"
              @update:model-value="(value) => wizard.setLinePrice(item.sku, value)"
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
            <q-toggle
              :model-value="wizard.generateInvoice.value"
              color="primary"
              @update:model-value="(v) => wizard.setGenerateInvoice(v)"
            />
          </div>
        </div>
      </q-card-section>
      <q-card-section v-if="wizard.generateInvoice.value" class="q-pt-none column" :class="gutterClass">
        <component
          :is="SelectField"
          :model-value="wizard.priceListCode.value"
          :record="{}"
          :config="{ label: 'Price list', options: priceListOptions, clearable: false}"
          header="PriceListCode"
          @update:model-value="(v) => wizard.set(FIELDS.PRICE_LIST, v)"
        />

        <!-- Plain wrapper is load-bearing: it absorbs q-col-gutter-md's -16px margin. -->
        <div>
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <component
                :is="SelectField"
                :model-value="wizard.discountType.value"
                :record="{}"
                :config="{ label: 'Discount type', options: DISCOUNT_TYPES, clearable: false}"
                header="DiscountType"
                @update:model-value="(v) => wizard.set(FIELDS.DISCOUNT_TYPE, v)"
              />
            </div>
            <div class="col-6">
              <component
                :is="NumberField"
                :model-value="wizard.discountValue.value"
                :record="{}"
                :config="{ label: wizard.discountType.value === 'PERCENT' ? 'Discount %' : 'Discount amount'}"
                header="DiscountValue"
                @update:model-value="(v) => wizard.set(FIELDS.DISCOUNT_VALUE, v)"
              />
            </div>
          </div>
        </div>

        <component
          :is="TextareaField"
          :model-value="wizard.get(FIELDS.INVOICE_COMMENT, '')"
          :record="{}"
          :config="{ label: 'Invoice note (optional)'}"
          header="InvoiceComment"
          @update:model-value="(v) => wizard.set(FIELDS.INVOICE_COMMENT, v)"
        />

        <q-separator />
        <div>
          <div v-for="line in summaryLines" :key="line.label" class="row justify-between"
               :class="line.strong ? 'text-body2 text-weight-medium' : 'text-body2 text-grey-8'">
            <span>{{ line.label }}</span><span>{{ line.value }}</span>
          </div>
          <q-separator class="q-my-xs" />
          <div class="row justify-between text-subtitle1 text-weight-bold">
            <span>Total</span><span>{{ _C(wizard.invoiceTotal.value) }}</span>
          </div>
          <div class="text-caption text-grey-7 q-pt-xs">{{ policyCaption }}</div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Step 3 — what sold and the invoice terms.
import { computed, defineComponent, h, useAttrs } from 'vue'
import { QItemLabel, QBtn } from 'quasar'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlList from 'components/abstract/List.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddSoldReview', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const DISCOUNT_TYPES = [
  { value: 'FLAT', label: 'Flat amount' },
  { value: 'PERCENT', label: 'Percentage' }
]

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard
const { _C } = useCurrency()
const { activePriceLists } = usePriceListResource()

const SelectField = resolveFieldComponent('select', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')
const NumberField = resolveFieldComponent('number', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

const hasSales = computed(() => wizard.soldRows.value.length > 0)

const lineCaption = (line) => {
  // Nothing is being billed, so no money belongs on the row at all.
  if (!wizard.generateInvoice.value) return ''
  if (line.unpriced) return 'Not in this price list — set a unit price to bill it'
  const base = _C(line.total)
  // The line's own tax, stated on the line that generated it — a reader reconciling the
  // header's tax figure otherwise has to divide it back out across the lines by hand.
  return line.tax > 0 ? `${base} · tax ${_C(line.tax)}` : base
}

const LineValueNote = defineComponent({
  name: 'SoldLineValueNote',
  props: { item: { type: Object, required: true } },
  setup: (props) => () => {
    const caption = lineCaption(props.item)
    if (!caption) return null
    return h(QItemLabel, {
      caption: true,
      class: props.item.unpriced ? 'text-negative' : 'text-grey-8'
    }, () => caption)
  }
})

const RepricedNote = defineComponent({
  name: 'SoldLineRepricedNote',
  props: { item: { type: Object, required: true } },
  setup: (props) => () => {
    const row = props.item
    if (!row.overridden || !wizard.generateInvoice.value) return null
    return h(QItemLabel, { caption: true, class: 'text-orange-9' }, () => [
      `was ${_C(row.listPrice)} `,
      h(QBtn, {
        flat: true,
        dense: true,
        noCaps: true,
        size: 'sm',
        color: 'primary',
        label: 'Restore',
        class: 'q-ml-xs q-px-xs',
        'aria-label': `Restore the price list's price for ${row.name}`,
        onClick: () => wizard.resetLinePrice(row.sku)
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

// Memoised: a fresh literal per render re-runs the control's watchers on every keystroke.
const PRICE_CONFIG = { label: 'Unit price', inputClass: 'text-right text-weight-bold' }

const summaryLines = computed(() => {
  const header = wizard.invoiceHeader.value
  const rows = [
    { label: 'Subtotal', value: _C(header.Subtotal), amount: header.Subtotal, strong: true },
    { label: 'Discount', value: `− ${_C(header.Discount)}`, amount: header.Discount },
    { label: 'Taxable amount', value: _C(header.TotalTaxableAmount), amount: header.TotalTaxableAmount },
    // One row per TAX CODE. A compound tax lands as its components, which is the
    // granularity the invoice stores and the granularity a tax return is filed at.
    ...wizard.invoiceTaxBreakdown.value.map((entry) => ({
      label: entry.TaxCode,
      value: _C(entry.TaxAmount),
      amount: entry.TaxAmount
    })),
    { label: 'Tax', value: _C(header.TotalTaxAmount), amount: header.TotalTaxAmount, strong: true },
    { label: 'Returns credited', value: `− ${_C(header.ReturnDeductionTotal)}`, amount: header.ReturnDeductionTotal }
  ]
  return rows.filter((row) => Number(row.amount) > 0)
})

const policyCaption = computed(() => {
  const { discountTaxPolicy, taxInclusive } = wizard.invoicePolicy.value
  const discountRule = discountTaxPolicy === 'PRE_TAX'
    ? 'Discount is applied before tax'
    : 'Tax is charged on the full value, then the discount is applied'
  return `${discountRule}. Prices ${taxInclusive ? 'include' : 'exclude'} tax.`
})

const priceListOptions = computed(() =>
  activePriceLists.value.map((list) => ({ value: list.code, label: list.name || list.code })))
</script>
