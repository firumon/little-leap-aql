<template>
  <div :class="gutterClass">
    <SectionDividerLabel label="INVOICE" />

    <!-- The facts an edit cannot move, stated as detail lines rather than disabled inputs: a
         greyed-out box invites a click that will never do anything (§13.4). -->
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div v-for="line in fixed" :key="line.key" class="aql-detail-line">
            <div class="aql-detail-key">{{ line.label }}</div>
            <div class="aql-detail-val">{{ line.value }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="TERMS" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="SelectField"
          :model-value="priceListCode"
          :record="{}"
          :config="priceListConfig"
          header="PriceListCode"
          @update:model-value="(value) => (priceListCode = value)"
        />

        <!-- Said loudly, and only when it applies. Switching the list re-prices every line the
             user did not touch and can move the discount to the other side of tax, so the one
             control on this page with consequences beyond its own row says so. -->
        <q-banner v-if="priceListSwitched" dense rounded class="bg-blue-1 text-body2">
          <template #avatar><q-icon name="sync_alt" color="primary" /></template>
          Every line you have not re-priced by hand is now billed at
          <strong>{{ priceListName }}</strong> prices, and this list's own tax and discount
          rules apply. Check the totals below before saving.
        </q-banner>

        <component
          :is="DateField"
          :model-value="dueDate"
          :record="{}"
          :config="dueDateConfig"
          header="DueDate"
          @update:model-value="(value) => (dueDate = value)"
        />

        <component
          :is="SelectField"
          :model-value="discountType"
          :record="{}"
          :config="discountTypeConfig"
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
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Edit › InvoiceTerms — the header terms an edit may move.
 *
 * ── WHAT IS FIXED, AND WHY IT IS SHOWN ANYWAY ──
 * The outlet and the issue date are read-only detail lines. They are on the page because they
 * are the CONTEXT the prices below only make sense in — a user correcting a unit price needs
 * to see which outlet they are correcting it for — and they are not inputs because moving an
 * invoice to a different outlet is a different bill, not an edit of this one.
 *
 * ── THE PRICE LIST *IS* EDITABLE, AND LEADS THE CARD ──
 * It is the heaviest control here: the list decides the tax-inclusive flag and the discount
 * policy every stored figure was computed under, so switching it re-derives the whole invoice
 * — lines the user has not touched re-price against the new list, and a list that disagrees
 * on discount policy moves the discount to the other side of tax. It leads because everything
 * under it is read in its terms, and it carries a banner while it differs from the list the
 * invoice was issued on.
 *
 * ── THE DISCOUNT REOPENS AS A FLAT AMOUNT ──
 * The sheet stores the RESOLVED discount and no type/value pair, so a percentage typed at
 * generation time is already an amount by the time the row exists. Layer 2's
 * `invoiceEditDefaults` owns that reading; this card only renders it. Switching the control
 * to `PERCENT` recomputes against the live subtotal, which is the only reading that can be
 * honoured.
 *
 * The discount control SWITCHES TYPE with the mode — currency for a flat amount, plain
 * number for a percentage — because a `%` value rendered with a currency symbol reads as
 * money and gets typed as money.
 *
 * ── THERE IS NO "REASON FOR THIS CHANGE" BOX ──
 * `OutletConsumptionInvoices` has no column for one. The `Progress*Comment` columns hold why
 * the invoice reached each STATE, and an edit reaches no new state — writing to them would
 * overwrite the note the invoice was raised under. The resource is audited (`Audit: 'TRUE'`),
 * so who changed it and when is already recorded; asking for a reason with nowhere to put it
 * would be a field that quietly discards what the user typed.
 *
 * Every field mounts through `resolveFieldComponent` (§2.4). Nothing is `dense` — these are
 * the primary inputs of the page. Spacing is `pageProps.gutter`, never a hardcoded margin
 * (§10.2). Config objects are memoised so a fresh literal per render does not re-run each
 * control's own watchers.
 *
 * No `<style>` block; `.aql-detail-*` are the canonical shared classes (ARCHITECTURE RULES §7).
 */
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useInvoiceEditContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Edit/useInvoiceEditContext'

defineOptions({ name: 'OutletConsumptionInvoicesEditInvoiceTerms', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const DateField = resolveFieldComponent('date', 'edit')
const SelectField = resolveFieldComponent('select', 'edit')
const NumberField = resolveFieldComponent('number', 'edit')
const CurrencyField = resolveFieldComponent('currency', 'edit')

const {
  ui, record, locked, outletName, priceListName, priceListSwitched, priceListOptions,
  dueDate, discountType, discountValue, priceListCode, loadSources
} = useInvoiceEditContext()

// The first card on the page pulls what the SUBMIT needs but nothing on screen shows — the
// invoice's existing tax-ledger rows, so they can be retired rather than duplicated. Done
// once, here, rather than in each card (§13.5).
onMounted(loadSources)

const text = (value) => (value == null ? '' : String(value).trim())

/**
 * The outlet by NAME, from the context's domain read — a code is never a name, and
 * re-joining the Outlets resource here would be a second implementation of a lookup the
 * Index and View pages already own (§6 — Enrich Once, Then Project).
 *
 * `OutletConsumptionCode` is deliberately NOT shown. It is a free-text carrier that holds a
 * comma-separated list on a bundled invoice and, on rows written through the batch-ref path,
 * an unresolved reference — so it cannot be rendered as a dependable fact, and it answers
 * nothing a user correcting a unit price is asking.
 */
const fixed = computed(() => {
  const row = record.value || {}

  return [
    { key: 'code', label: 'Invoice', value: text(row.Code) || '—' },
    { key: 'outlet', label: 'Outlet', value: outletName.value || '—' },
    { key: 'date', label: 'Issued', value: text(row.Date) || '—' }
  ]
})

const priceListConfig = computed(() => ({
  options: priceListOptions.value,
  label: 'Price list',
  clearable: false,
  disable: locked.value
}))

const dueDateConfig = computed(() => ({
  label: 'Due date',
  clearable: false,
  disable: locked.value
}))

const discountTypeConfig = computed(() => ({
  options: [
    { value: 'FLAT', label: 'Flat amount' },
    { value: 'PERCENT', label: 'Percentage' }
  ],
  label: 'Discount type',
  clearable: false,
  disable: locked.value
}))

const discountConfig = computed(() => (discountType.value === 'PERCENT'
  ? { label: 'Discount %', suffix: '%', min: 0, max: 100, disable: locked.value }
  : { label: 'Discount amount', min: 0, disable: locked.value }))
</script>
