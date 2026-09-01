<template>
  <div :class="gutterClass">
    <q-banner v-if="!canCancel" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      This receipt can no longer be cancelled.
    </q-banner>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-caption text-grey-7">CANCELLING</div>
            <div class="text-subtitle1 text-weight-medium">{{ code }}</div>
            <div class="text-caption text-grey-8">{{ outletName }}</div>
          </div>
          <div class="col-auto text-h6">{{ money(amount) }}</div>
        </div>

        <q-list separator dense class="q-mt-sm">
          <q-item>
            <q-item-section>Credited invoice</q-item-section>
            <q-item-section side>{{ invoiceCode || '—' }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>Invoice total</q-item-section>
            <q-item-section side>{{ money(invoiceTotal) }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>Still owed after this</q-item-section>
            <q-item-section side class="text-weight-medium text-orange-9">
              {{ money(balanceAfter) }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Why is this receipt cancelled?</div>
        <div class="text-caption text-grey-8">{{ outcome }}</div>

        <component
          :is="TextareaField"
          :model-value="comment"
          :record="{}"
          :config="{ label: 'Cancellation Reason *', required: true }"
          header="ProgressCancelledComment"
          :disable="!canCancel"
          @update:model-value="(value) => { comment = value }"
        />
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
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useDataStore } from 'src/stores/data'
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
const sources = [useRecord(PAYMENTS), useRecord(INVOICES)]
Promise.all(sources.map((source) => source.reload()))

const ui = useAQLConfig()
const dataStore = useDataStore()
const { user } = useAuth()
const { _C } = useCurrencyResource()
const { getOutlet } = useOutletResource()

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const rows = (name) => (dataStore.getRecords(name) || [])

const { code: routeCode } = useRouteConfig()
const code = computed(() => text(routeCode.value))

// `resourceRecord` is empty on an action route, so the receipt is read from the rows this
// card just opened, with the record loader as the fallback once it settles.
const record = computed(() => {
  if (!code.value) return resourceRecord?.record?.value || null
  return rows(PAYMENTS).find((row) => text(row.Code) === code.value) ||
    resourceRecord?.record?.value ||
    null
})
const amount = computed(() => num(record.value?.Amount))
const outletCode = computed(() => text(record.value?.OutletCode))
const outletName = computed(() => text(getOutlet(outletCode.value)?.Name) || outletCode.value)

const invoiceCode = computed(() => text(record.value?.OutletConsumptionInvoiceCode))
const invoice = computed(() =>
  rows(INVOICES).find((row) => text(row.Code) === invoiceCode.value) || null)

const invoicePayments = computed(() => rows(PAYMENTS)
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
