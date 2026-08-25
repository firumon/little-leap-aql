<template>
  <div v-if="invoice">
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Payment</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-icon :name="relatedIcon(invoice.Progress)" size="16px" :color="relatedColor(invoice.Progress)" class="q-mr-xs" />
              <q-badge rounded :color="relatedColor(invoice.Progress)" :label="relatedLabel(invoice.Progress)" />
            </span>
          </div>
          <div v-for="(line, i) in lines" :key="line.label" class="items-center"
               :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(i + 1)">
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
              <!-- Navigation sits ON the code it navigates to, as a quiet icon. A
                   full-width "Open Invoice" button below the grid competed with the
                   cancellation FAB for the page's only strong call to action, while
                   leading nowhere the reader had not already read. -->
              <q-btn
                v-if="line.isCode"
                flat
                round
                dense
                icon="open_in_new"
                color="primary"
                size="sm"
                class="q-ml-xs"
                aria-label="Open this invoice"
                @click="openInvoice"
              >
                <q-tooltip>Open invoice</q-tooltip>
              </q-btn>
            </span>
          </div>
        </div>

        <!-- Stated only when this invoice covers more than this audit. A bundled invoice
             showing a total larger than this audit's own sales is otherwise unexplained. -->
        <q-banner v-if="siblings.length" dense rounded class="bg-grey-2 text-body2 q-mt-sm">
          This invoice also covers {{ siblings.length }} earlier audit(s) at this outlet, so
          its total is larger than this audit alone.
        </q-banner>

      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * View › Section 4 — the invoice covering this audit.
 *
 * Hidden outright when there is none — the common state right after an audit is recorded,
 * and an "awaiting invoice" card would restate what the header's own Progress chip already
 * says.
 *
 * The invoice is matched by MEMBERSHIP in its comma-separated `OutletConsumptionCode`, not
 * by equality (the match lives in Layer 2). That is what makes a bundled invoice resolve
 * for every audit on it, and it is why the banner exists: an invoice whose total exceeds
 * this audit's sales needs to say why.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useConsumptionView, formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionViewContext'
import { netPayableOf, storedTaxBreakdown } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'

defineOptions({ name: 'OutletConsumptionsViewInvoiceDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Invoice' }
})

const { evaluate, ui, nav } = useConsumptionViewContext()
const { invoice, invoiceSiblings, relatedColor, relatedIcon, relatedLabel } = useConsumptionView()
const { _C } = useCurrency()

const finalTitle = computed(() => evaluate(props.title))
const siblings = computed(() => invoiceSiblings.value)

const lines = computed(() => {
  const row = invoice.value
  if (!row) return []
  // The net payable is DERIVED IN LAYER 2, not here. `OutletConsumptionInvoices` has no
  // `Total` column, and the formula depends on the price list's discount policy — under
  // PRE_TAX the discount is already inside `TotalTaxableAmount`, so this card subtracting it
  // again would understate every discounted invoice it displays.
  const net = netPayableOf(row)
  return [
    // `isCode` is what mounts the inline open-in-new button beside this one row.
    { label: 'Invoice', value: row.Code || '', isCode: !!row.Code },
    { label: 'Date', value: formatDate(row.Date) },
    { label: 'Subtotal', value: _C(Number(row.Subtotal) || 0) },
    { label: 'Discount', value: Number(row.Discount) > 0 ? `− ${_C(Number(row.Discount))}` : '' },
    { label: 'Taxable amount', value: Number(row.TotalTaxableAmount) > 0 ? _C(Number(row.TotalTaxableAmount)) : '' },
    // One row per TAX CODE, read straight off the header's grouped `TaxDetails` rather
    // than re-summing the item rows — the breakdown a reader reconciles against is the one
    // that was stored, not one this card derived a second time.
    ...storedTaxBreakdown(row)
      .filter((entry) => Number(entry.TaxAmount) > 0)
      .map((entry) => ({
        label: entry.TaxCode,
        value: _C(Number(entry.TaxAmount) || 0)
      })),
    { label: 'Tax', value: Number(row.TotalTaxAmount) > 0 ? _C(Number(row.TotalTaxAmount)) : '' },
    { label: 'Returns credited', value: Number(row.ReturnDeductionTotal) > 0 ? `− ${_C(Number(row.ReturnDeductionTotal))}` : '' },
    { label: 'Total', value: _C(net) }
  ].filter((line) => String(line.value).trim())
})

/** Cross-resource navigation through the relay — a card never imports `useResourceNav`. */
function openInvoice () {
  nav.goTo('view', {
    scope: 'operation',
    resourceSlug: 'outlet-consumption-invoices',
    code: invoice.value?.Code
  })
}

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
