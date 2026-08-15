<template>
  <!-- Hidden outright when there is nothing sold: an audit that found only damage has no
       invoice to configure, and a card asking about one would be a question with no
       subject. `v-if` at the root, never `v-show`, so no blank gap is left in the page's
       gutter stack (§10.4). -->
  <div v-if="visible && hasSales" :class="gutterClass">
    <!-- Headings sit OUTSIDE their cards, so a scroll down the step is scannable by
         heading alone and every card starts with content rather than a label (§7.5). -->
    <SectionDividerLabel label="SOLD THIS VISIT" />
    <AppList
      :items="wizard.invoiceLines.value"
      :item-class="ui.cardClass"
      :layout="ROW_LAYOUT"
      :content="ROW_CONTENT"
      :meta-layout="META_LAYOUT"
      :meta-label="metaLabel"
      :meta-caption="metaCaption"
    />

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
          <div class="row justify-between text-body2">
            <span>Subtotal</span><span>{{ _C(wizard.invoiceSubtotal.value) }}</span>
          </div>
          <div v-if="wizard.invoiceDiscount.value > 0" class="row justify-between text-body2">
            <span>Discount</span><span>− {{ _C(wizard.invoiceDiscount.value) }}</span>
          </div>
          <div class="row justify-between text-subtitle1 text-weight-bold q-pt-xs">
            <span>Total</span><span>{{ _C(wizard.invoiceTotal.value) }}</span>
          </div>
          <div class="text-caption text-grey-7">Tax is applied on submission from each item's tax code.</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Hidden entirely when the outlet has no backlog — a bundling card offering nothing
         to bundle is a question the user has to read to dismiss. -->
    <template v-if="wizard.generateInvoice.value && wizard.bundleCandidates.value.length">
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
              <q-item-label caption>{{ candidate.username }} · {{ candidate.qty }} units</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
/**
 * Step 3 — sold review and invoice configuration.
 *
 * Three differently-scoped questions, so three cards (§7.5): what was sold (a read-only
 * restatement of step 2), how this invoice is priced, and which earlier audits ride along
 * on it.
 *
 * BUNDLING is the reason the third card exists. An outlet visited weekly but invoiced
 * monthly accumulates four uninvoiced audits; billing them separately produces four
 * invoices the outlet then has to reconcile. Ticking them here puts every line on one
 * invoice and walks all of them to `INVOICE_GENERATED` in the same batch — the invoice's
 * `OutletConsumptionCode` column holds the comma-separated list, joined server-side so the
 * code this batch is about to create stays an unresolved reference.
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
import AppList from "components/app/AppList.vue";

defineOptions({ name: 'OutletConsumptionsAddSoldReview', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

// Hoisted to module-adjacent constant scope rather than allocated inline in the template —
// a fresh array every render re-runs the field's resolvers on every keystroke (§11 rule 5).
const DISCOUNT_TYPES = [
  { value: 'FLAT', label: 'Flat amount' },
  { value: 'PERCENT', label: 'Percentage' }
]

// Every list layout array is a module constant, never an inline literal in the template:
// a fresh array identity on each render re-runs `abstract/List.vue`'s resolvers, which
// watch these props BY REFERENCE (§11 rule 5).
const ROW_LAYOUT = ['label', 'caption']
const ROW_CONTENT = ['name', 'variant']
const META_LAYOUT = ['label', 'caption']

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard
const { _C } = useCurrency()
const { activePriceLists } = usePriceListResource()

const SelectField = resolveFieldComponent('select', 'add')
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
const metaLabel = (line) => (line.unpriced ? 'No price' : _C(line.total))
const metaCaption = (line) => (line.unpriced
  ? `${line.qty} × not in this price list`
  : `${line.qty} × ${_C(line.price ?? 0)}`)

const priceListOptions = computed(() =>
  activePriceLists.value.map((list) => ({ value: list.code, label: list.name || list.code })))
</script>
