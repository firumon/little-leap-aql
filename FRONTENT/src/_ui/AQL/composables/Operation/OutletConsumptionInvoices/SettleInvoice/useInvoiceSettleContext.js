import { inject, computed, ref, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { invoiceCurrencyOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  settlementGate,
  settlementReasons,
  progressMetaOf,
  SETTLEMENT_OTHER
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { buildSettlementNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'

// OutletConsumptionInvoices > SettleInvoice - the one inject() behind the two cards, and the
// route's own hydration point. The three answers are written straight onto the standing
// record node, so submit sends what the screen shows.

export const NODE = 'OutletConsumptionInvoices'

const REASON = 'SettlementReason'
const MISMATCH = 'SettlementMismatchAmount'
const COMMENT = 'ProgressPaidComment'

const text = (value) => (value == null ? '' : String(value).trim())

// Whether somebody has typed an amount. Page-scoped: the seed clears it on every mount, and
// only the decision card sets it.
const mismatchTouched = ref(false)

export function useInvoiceSettleContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)

  const { _C } = useCurrencyResource()
  const index = useInvoiceIndex()

  const record = computed(() => resourceRecord?.record?.value || null)
  const code = computed(() => text(record.value?.Code))

  /** The invoice's own payment rows, already joined by the shared index. */
  const payments = computed(() => index.rowByCode.value.get(code.value)?.payments || [])

  /** Billed, collected, outstanding and the suggested write-off — one Layer 2 call. */
  const gate = computed(() => settlementGate(record.value || {}, payments.value))

  const currencyCode = computed(() => invoiceCurrencyOf(record.value?.PriceListCode))
  const money = (value) => _C(Number(value) || 0, true, currencyCode.value)

  const outletName = computed(() =>
    index.outletNameByCode.value.get(text(record.value?.OutletCode)) || text(record.value?.OutletCode))

  const field = (header) => pageState?.getRecord(header, NODE)
  const setField = (header, value) => pageState?.setRecord(header, value, NODE)

  const reason = computed({
    get: () => text(field(REASON)),
    set: (value) => setField(REASON, text(value))
  })

  // NOT coerced: the card tells an untouched field from a deliberate blank, and a blank
  // means the whole outstanding balance.
  const mismatch = computed({
    get: () => field(MISMATCH),
    set: (value) => {
      mismatchTouched.value = true
      setField(MISMATCH, value)
    }
  })

  const comment = computed({
    get: () => text(field(COMMENT)),
    set: (value) => setField(COMMENT, text(value))
  })

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui: useAQLConfig(),

    record,
    code,
    payments,
    gate,
    money,
    outletName,
    progressMeta: computed(() => progressMetaOf(record.value)),

    reasons: computed(() => settlementReasons()),
    reason,
    mismatch,
    comment,
    commentRequired: computed(() => reason.value === SETTLEMENT_OTHER)
  }
}

// The route's ONE hydration point (§13.7). Called by a single card, or the node would be
// mounted once per card that called it.
export function useInvoiceSettleSeed () {
  const context = useInvoiceSettleContext()
  const { pageState, record, code, payments, gate, reason, mismatch, comment } = context
  const { user } = useAuth()

  // An action route's resolver fetches the invoice alone, so the payments the balance is
  // derived from are opened here.
  usePageRecord('OutletPayments')

  mismatchTouched.value = false

  // The node stands as soon as the invoice is here. The payments land later and move the
  // balance, so the amount follows it until somebody types over it.
  watch([record, payments], () => {
    const row = record.value
    if (!pageState || !code.value || !gate.value.allowed) return

    const kept = {
      reason: reason.value,
      comment: comment.value,
      mismatch: mismatchTouched.value ? mismatch.value : null
    }

    pageState.resetForResource(NODE)
    pageState.initResource(NODE, { code: code.value, isPrimaryKey: true })
    pageState.applyNodes(buildSettlementNodes({
      record: row,
      payments: payments.value,
      reason: kept.reason,
      comment: kept.comment,
      mismatchAmount: kept.mismatch,
      actorName: text(user.value?.name || user.value?.email)
    }))
  }, { immediate: true })

  return context
}
