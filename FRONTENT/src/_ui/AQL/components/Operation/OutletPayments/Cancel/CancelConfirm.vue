<template>
  <div :class="gutterClass">
    <q-banner v-if="!canCancel" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      This receipt can no longer be cancelled.
    </q-banner>

    <SectionDividerLabel label="PAYMENT RECEIPT" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-bold">{{ outletName }}</div>
            <div class="text-caption text-grey-7">{{ metaLine }}</div>
          </div>
          <div class="col-auto text-right text-h5 text-weight-bold no-wrap">
            {{ money(amount) }}
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section v-if="invoiceCode" class="q-gutter-y-xs">
        <div class="row items-center no-wrap text-body2">
          <div class="col text-grey-8">Credited invoice</div>
          <div class="col-auto text-weight-medium">{{ invoiceCode }}</div>
        </div>
        <div class="row items-center no-wrap text-body2">
          <div class="col text-grey-8">Invoice total</div>
          <div class="col-auto">{{ money(invoiceTotal) }}</div>
        </div>
        <div class="row items-center no-wrap text-body2">
          <div class="col text-grey-8">Still owed after this</div>
          <div class="col-auto text-orange-9 text-weight-medium">{{ money(balanceAfter) }}</div>
        </div>
      </q-card-section>

      <q-card-section v-else class="text-caption text-grey-7">
        No invoice is credited by this receipt.
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="CANCELLATION REASON" />
    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section>
        <div class="text-caption text-grey-8 q-mb-sm">{{ outcome }}</div>

        <component
          :is="TextareaField"
          :model-value="comment"
          :record="{}"
          :config="{ label: 'Cancellation Reason *', required: true, rows: 3 }"
          header="ProgressCancelledComment"
          :disable="!canCancel"
          @update:model-value="(value) => { comment = value }"
        />

        <div class="text-caption text-grey-7 q-mt-xs">
          Saved on the receipt's Cancelled Comment for audit.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>
<script setup>
/**
 * OutletPayments › Cancel › CancelConfirm — the cancel action route's only card.
 *
 * THE HYDRATION POINT (§5.5) and the read-time write: an `_action` resolver fetches the
 * receipt alone, so the invoice and its other payments are opened here — and the moment they
 * land, the whole batch goes into pageState. Nothing is assembled at submit.
 *
 * The reason binds straight onto the queued `Cancel` action (§15.1), so what is typed IS the
 * node. The invoice's own walk back to PARTIALLY_PAID or PENDING_PAYMENT carries the same
 * reason, so the watcher re-cuts the batch as it changes.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, inject, watch, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import {
  buildOutletPaymentCancellationNodes
} from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'
import { canCancelPayment } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentProgress'
import {
  netInvoiceTotalOf,
  countsAsPayment
} from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentAllocation'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'

defineOptions({ name: 'OutletPaymentsCancelConfirm', inheritAttrs: false })

const PAYMENTS = 'OutletPayments'
const INVOICES = 'OutletConsumptionInvoices'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const resourceRecord = inject('resourceRecord', null)

// An `_action` resolver fetches nothing (usePageResolver skips the load for action pages),
// so this card opens every row it reads - its own receipt included.
const sources = [usePageRecord(PAYMENTS), usePageRecord(INVOICES)]
Promise.all(sources.map((source) => source.reload()))

const ui = useAQLConfig()
const { user } = useAuth()
const { _C } = useCurrencyResource()
const { getOutlet } = useOutletResource()

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const { code: routeCode } = useRouteConfig()
const code = computed(() => text(routeCode.value))

// `resourceRecord` is empty on an action route, so the receipt is read from the rows this
// card just opened, with the record loader as the fallback once it settles.
const record = computed(() => {
  if (!code.value) return resourceRecord?.record?.value || null
  return (resourceRecord?.records?.value || []).find((row) => text(row.Code) === code.value) ||
    resourceRecord?.record?.value ||
    null
})
const amount = computed(() => num(record.value?.Amount))
const outletCode = computed(() => text(record.value?.OutletCode))
const outletName = computed(() => text(getOutlet(outletCode.value)?.Name) || outletCode.value)

const metaLine = computed(() => [
  code.value,
  text(record.value?.Date),
  text(record.value?.Mode)
].filter(Boolean).join(' • '))

const invoiceCode = computed(() => text(record.value?.OutletConsumptionInvoiceCode))
const invoice = computed(() =>
  record.value?.$outletconsumptioninvoice || record.value?.$OutletConsumptionInvoice || null)

const invoicePayments = computed(() => (resourceRecord?.records?.value || [])
  .filter((row) => text(row.OutletConsumptionInvoiceCode) === invoiceCode.value))

const invoiceTotal = computed(() => (invoice.value ? netInvoiceTotalOf(invoice.value) : 0))

/** What the invoice is left owing once this receipt is taken off it. */
const balanceAfter = computed(() => {
  const others = invoicePayments.value
    .filter((row) => text(row.Code) !== code.value && countsAsPayment(row))
    .reduce((sum, row) => sum + num(row.Amount), 0)
  return Math.max(0, Number((invoiceTotal.value - others).toFixed(2)))
})

const money = (value) => _C(num(value), true)

const canCancel = computed(() => !!record.value && canCancelPayment(record.value))

const TextareaField = resolveFieldComponent('textarea', 'add')

const comment = pageState
  ? pageState.useActions('Cancel', 'fields.ProgressCancelledComment', PAYMENTS)
  : computed(() => '')

const outcome = computed(() => {
  if (!invoiceCode.value) return 'The receipt is reversed. No invoice is credited by it.'
  return `The receipt is reversed and ${invoiceCode.value} is walked back to what it still owes.`
})

// Read time, not submit time: the moment the receipt and its invoice are loaded the whole
// batch is in pageState. The reason re-cuts it because it travels into both stamps.
function mountNodes () {
  // Gated on `canCancel`, not just on the record: once the submit lands the receipt reads
  // CANCELLED, the builder vetoes, and an ungated rebuild would notify a refusal at the
  // very moment the cancellation succeeded (UI_PAGE_STATE.md §5B.4).
  if (!pageState || !record.value || !canCancel.value) return

  // The batch is queued ACTIONS, which are bodyless and create no node - and with no node
  // the sticky bar hides itself. This coded node is the page's ADDRESS, nothing more: an
  // empty record ships no request of its own (UI_PAGE_STATE.md, `requestForNode`).
  if (!pageState.hasNode(PAYMENTS)) {
    pageState.initResource(PAYMENTS, { code: code.value, isPrimaryKey: true })
  }

  pageState.applyNodes(buildOutletPaymentCancellationNodes({
    paymentRecord: record.value,
    comment: text(comment.value),
    actorName: text(user.value?.name || user.value?.email) || 'Unknown',
    invoiceRecord: invoice.value,
    allInvoicePayments: invoicePayments.value,
    requireComment: false
  }))
}

watch([record, invoice, invoicePayments], mountNodes, { immediate: true })
watch(comment, mountNodes)
</script>
