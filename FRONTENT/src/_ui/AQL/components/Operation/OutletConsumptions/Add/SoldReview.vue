<template>
  <!-- Hidden outright when there is nothing sold: an audit that found only damage has no
       invoice to configure, and a card asking about one would be a question with no
       subject. `v-if` at the root, never `v-show`, so no blank gap is left in the page's
       gutter stack (§10.4). -->
  <div v-if="visible && hasSales" :class="gutterClass">
    <!-- Headings sit OUTSIDE their cards, so a scroll down the step is scannable by
         heading alone and every card starts with content rather than a label (§7.5). -->
    <SectionDividerLabel label="SOLD THIS VISIT" />
    <q-card flat bordered :class="ui.cardClass">
      <q-list separator>
        <q-item v-for="line in wizard.invoiceLines.value" :key="line.sku" class="q-py-sm">
          <q-item-section :class="ui.flexWrapTextClass">
            <q-item-label class="text-weight-medium">{{ line.name }}</q-item-label>
            <q-item-label caption>{{ line.variant }}</q-item-label>
            <q-item-label caption :class="line.unpriced ? 'text-negative' : 'text-grey-8'">
              {{ lineCaption(line) }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row items-center no-wrap q-gutter-x-sm">
              <!-- The quantity as a SOLID chip, not a caption. It is the one figure an
                   officer scans this list for — it is what they just counted — and it is a
                   short list of their own numbers, so it reads as an anchor rather than as
                   the wall of alarms a solid chip makes of a long banded column (§7.2). -->
              <q-chip color="primary" text-color="white" class="text-bold" size="md" square :label="`${line.qty}`" />
              <div style="width: 96px">
                <!-- The price list is the DEFAULT, not the law. Editing here re-runs the
                     whole engine — line tax, discount apportionment and the payable move
                     together — because the override is passed to the calculation as a price
                     RESOLVER rather than patched onto a total the engine never saw. -->
                <component
                  :is="CurrencyField"
                  :model-value="line.price"
                  :record="line"
                  :config="{ label: 'Unit price', inputClass: 'text-right text-weight-bold' }"
                  header="Price"
                  @update:model-value="(value) => wizard.setLinePrice(line.sku, value)"
                />
              </div>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <!-- Hidden entirely when the outlet has no backlog — a bundling card offering nothing
         to bundle is a question the user has to read to dismiss. -->
    <template v-if="wizard.bundleCandidates.value.length">
      <SectionDividerLabel label="BUNDLE EARLIER CONSUMPTIONS" />
      <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-caption text-grey-8 q-pb-sm">
          This outlet has earlier consumptions that were never billed. Tick any to put them on
          this same invoice.
        </div>
        <q-list separator dense>
          <q-item v-for="candidate in wizard.bundleCandidates.value" :key="candidate.code" tag="label" v-ripple>
            <q-item-section side top>
              <q-checkbox
                :model-value="wizard.bundledCodes.value.includes(candidate.code)"
                @update:model-value="() => wizard.toggleBundled(candidate.code)"
              />
            </q-item-section>
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ candidate.date }}</q-item-label>
              <!-- The units clause appears only when the lines are actually loaded: a
                   candidate whose item rows have not been fetched must not read as an
                   empty consumption (see `bundleCandidates`). -->
              <q-item-label caption>
                {{ candidate.username }}<template v-if="candidate.qty !== undefined"> · {{ candidate.qty }} units</template>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      </q-card>
    </template>

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
              @update:model-value="(v) => wizard.set(FIELDS.GENERATE_INVOICE, v === true)"
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

        <!-- The discount pair is wrapped in a PLAIN div, and that wrapper is load-bearing.
             `q-col-gutter-md` puts a -16px margin on the element carrying it, so applying
             it directly to a child of the `q-gutter-y-md` column made the row pull itself
             back up by exactly the 16px the column had just given it — the price list and
             the discount fields rendered overlapping by a pixel-measured -16. The wrapper
             absorbs the negative margin, so the column's rhythm survives it. -->
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
        <!-- The totals are one block, so they carry their own tight internal rhythm rather
             than inheriting the section's `q-gutter-y-md` — figures in a running total
             belong together, not spaced like separate controls. -->
        <div>
          <div v-for="line in summaryLines" :key="line.label" class="row justify-between"
               :class="line.strong ? 'text-body2 text-weight-medium' : 'text-body2 text-grey-8'">
            <span>{{ line.label }}</span><span>{{ line.value }}</span>
          </div>
          <q-separator class="q-my-xs" />
          <div class="row justify-between text-subtitle1 text-weight-bold">
            <span>Total</span><span>{{ _C(wizard.invoiceTotal.value) }}</span>
          </div>
          <!-- States which policy produced these numbers, because the SAME lines and the
               same discount give a different total under each one — a reader who cannot see
               the policy cannot check the arithmetic. -->
          <div class="text-caption text-grey-7 q-pt-xs">{{ policyCaption }}</div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 3 — sold review and invoice configuration.
 *
 * Three differently-scoped questions, so three cards (§7.5), and they are asked in the order
 * an accountant would ask them:
 *
 *   1. SOLD THIS VISIT           what this audit found sold, with the unit price editable
 *   2. BUNDLE EARLIER            which earlier unbilled audits ride along on the same bill
 *   3. INVOICING                 the price list, discount and the total of BOTH of the above
 *
 * The order is load-bearing: the total covers the bundled lines as well as this visit's, so
 * the two lists that feed it have to be settled before it is read. Showing the total first,
 * with the bundling underneath, invited the officer to confirm an amount that then changed
 * under them.
 *
 * BUNDLING is the reason the second card exists. An outlet visited weekly but invoiced
 * monthly accumulates four uninvoiced audits; billing them separately produces four
 * invoices the outlet then has to reconcile. Ticking them here puts every line on one
 * invoice and walks all of them to `INVOICE_GENERATED` in the same batch — the invoice's
 * `OutletConsumptionCode` column holds the comma-separated list, joined server-side so the
 * code this batch is about to create stays an unresolved reference.
 *
 * The UNIT PRICE is editable on the first card and nowhere else. The price list is the
 * default, not the law — a negotiated one-off or a stale list both need overriding at the
 * moment of billing — and the override is handed to the engine as a price RESOLVER, so line
 * tax, discount apportionment and the payable all move with it.
 *
 * "Generate invoice" is ON by default: the overwhelmingly common case is that a sale is
 * billed, and defaulting it off would make the exception the default path.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddSoldReview', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

// Hoisted to module-adjacent constant scope rather than allocated inline in the template —
// a fresh array every render re-runs the field's resolvers on every keystroke (§11 rule 5).
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

/**
 * The line's value, or a warning when the SKU has no price in the chosen list.
 *
 * An unpriced line is SURFACED rather than billed at zero — a silent zero is how
 * consignment stock gets given away. `validateConsumption` refuses the submission for the
 * same reason; this is the half the user can act on, by switching price list.
 */
const lineCaption = (line) => {
  if (line.unpriced) return 'Not in this price list — set a unit price to bill it'
  const base = _C(line.total)
  // The line's own tax, stated on the line that generated it — a reader reconciling the
  // header's tax figure otherwise has to divide it back out across the lines by hand.
  return line.tax > 0 ? `${base} · tax ${_C(line.tax)}` : base
}

/**
 * The running total, read ENTIRELY off the Layer 2 engine's header.
 *
 * Every row here is a stored invoice column, so what the user confirms on this step and what
 * the batch writes are the same figures — not two calculations that happen to agree. Zero
 * rows are dropped rather than shown as `0.00`: a discount line on an undiscounted invoice
 * is a row the reader has to check before dismissing.
 */
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
