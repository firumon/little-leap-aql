<template>
  <div v-if="isActive" :class="gutterClass">
    <SectionDividerLabel label="TERMS" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="DateField"
          :model-value="dueDate"
          :record="{}"
          :config="{ label: 'Due date', clearable: false }"
          header="DueDate"
          @update:model-value="(value) => (dueDate = value)"
        />

        <component
          :is="SelectField"
          :model-value="discountType"
          :record="{}"
          :config="{ options: discountTypes, label: 'Discount type', clearable: false }"
          header="DiscountType"
          @update:model-value="(value) => (discountType = value)"
        />

        <component
          :is="discountType === 'PERCENT' ? NumberField : CurrencyField"
          :model-value="discountValue"
          :record="{}"
          :config="discountConfig"
          header="Discount"
          @update:model-value="(value) => (discountValue = value)"
        />
      </q-card-section>
    </q-card>

    <template v-if="creditableReturns.length">
      <SectionDividerLabel label="RETURN CREDITS" />

      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <!-- OPT-IN. Whether a credit belongs on THIS invoice is a commercial call — it may
               be settled separately, held for a warehouse inspection, or carried to a later
               bill — and applying it silently also closes the return without the user's
               agreement. -->
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle1 text-weight-medium">Credit pending returns</div>
              <div class="text-caption text-grey-8">
                {{ creditableReturns.length }} return{{ creditableReturns.length === 1 ? '' : 's' }}
                awaiting adjustment for this outlet.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle v-model="applyReturnsModel" color="primary" />
            </div>
          </div>
        </q-card-section>

        <template v-if="applyReturnsModel">
          <q-separator />
          <q-list separator>
            <q-item v-for="entry in creditableReturns" :key="entry.code" v-ripple tag="label" clickable>
              <q-item-section side top>
                <q-checkbox v-model="chosenReturns" :val="entry.code" />
              </q-item-section>

              <q-item-section :class="ui.flexWrapTextClass">
                <q-item-label class="text-weight-medium">{{ entry.qty }} x {{ entry.primary }}</q-item-label>
                <q-item-label caption>{{ entry.secondary }}</q-item-label>
                <q-item-label caption>
                  {{ entry.date }}
                  <span v-if="entry.reason"> · {{ entry.reason }}</span>
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-chip dense square outline color="blue-8" class="q-my-none">
                  {{ money(entry.amount) }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </template>
      </q-card>
    </template>

    <SectionDividerLabel label="SUMMARY" />

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
        <div class="text-subtitle2 text-weight-bold">Grand Total</div>
        <div class="text-h6 text-weight-bolder text-primary">{{ money(grandTotal) }}</div>
      </q-card-section>
    </q-card>

    <template v-if="taxBreakdown.length">
      <SectionDividerLabel label="TAX SUMMARY" />

      <q-card flat bordered :class="ui.cardClass">
        <q-card-section class="q-py-sm">
          <div class="aql-detail-grid">
            <div v-for="entry in taxBreakdown" :key="entry.TaxCode" class="aql-detail-line">
              <div class="aql-detail-key">
                {{ entry.TaxCode }} on {{ money(entry.TaxableAmount) }}
              </div>
              <div class="aql-detail-val">{{ money(entry.TaxAmount) }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </template>

    <SectionDividerLabel label="COMMENT" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <component
          :is="TextareaField"
          :model-value="comment"
          :record="{}"
          :config="{ label: 'Comment (optional)' }"
          header="Comment"
          @update:model-value="(value) => (comment = value)"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Step 3 - terms, discount, credited returns, and the total. Every figure comes from the
// one `calculateConsumptionInvoice` call on the page context, which is also what gets
// submitted, so the screen and the sheet cannot disagree.
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useInvoiceAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Add/useInvoiceAddContext'

defineOptions({ name: 'OutletConsumptionInvoicesAddInvoiceReview', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: 3 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const DateField = resolveFieldComponent('date', 'add')
const SelectField = resolveFieldComponent('select', 'add')
const NumberField = resolveFieldComponent('number', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')

const {
  ui, money, invoice, dueDate, discountType, discountValue, comment,
  creditableReturns, applyReturns, selectedReturnCodes, step: currentStep
} = useInvoiceAddContext()

const isActive = computed(() =>
  props.step == null || Number(props.step) === currentStep.value)

// `v-model` cannot assign through a destructured computed, so these thin wrappers do it.
const applyReturnsModel = computed({
  get: () => applyReturns.value,
  set: (value) => { applyReturns.value = value }
})

const chosenReturns = computed({
  get: () => selectedReturnCodes.value,
  set: (value) => { selectedReturnCodes.value = [...(value || [])] }
})

const discountTypes = [
  { value: 'FLAT', label: 'Flat amount' },
  { value: 'PERCENT', label: 'Percentage' }
]

const discountConfig = computed(() => (discountType.value === 'PERCENT'
  ? { label: 'Discount %', suffix: '%', min: 0, max: 100 }
  : { label: 'Discount amount', min: 0 }))

const header = computed(() => invoice.value.header)
const taxBreakdown = computed(() => invoice.value.taxBreakdown)
const grandTotal = computed(() => header.value.Total)

const summary = computed(() => {
  const entry = header.value
  const preTax = invoice.value.policy.discountTaxPolicy === 'PRE_TAX'

  // Every line is stated even at zero: this is a reconciliation, so a missing row would
  // leave the reader guessing.
  return [
    { key: 'subtotal', label: 'Subtotal', value: entry.Subtotal },
    {
      key: 'discount',
      // Under PRE_TAX the discount is already inside each line's taxable amount, so the label
      // says where it went rather than implying a second deduction.
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
