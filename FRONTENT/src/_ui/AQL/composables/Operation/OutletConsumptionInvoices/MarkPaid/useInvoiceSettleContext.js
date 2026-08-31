import { inject, computed } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { invoiceCurrencyOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  settlementGate,
  settlementReasons,
  progressMetaOf,
  SETTLEMENT_OTHER
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

/**
 * OutletConsumptionInvoices › MarkPaid — the injection relay for the settle route
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `MarkPaid/`, the page tier (§6.2): only this route provides this context.
 *
 * It DERIVES NOTHING. The three figures, the eligibility verdict and the reason list are all
 * read off Layer 2 — `settlementGate` answers the money and the state, `settlementReasons`
 * answers the dropdown from `AppOptions`. A `computed()` here that subtracted payments from
 * a total would be a second implementation of the number the builder is about to write off.
 *
 * The three answers live in CONTROL fields, not record fields. `SettlementReason`,
 * `SettlementMismatchAmount` and `ProgressPaidComment` are workflow columns written by the
 * transition itself, so they are never form fields in any state (§13.3, §13.5) — the control
 * node is the working surface the sticky bar reads back.
 */
export const NODE = 'OutletConsumptionInvoices'

export function useInvoiceSettleContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)

  const { _C } = useCurrencyResource()
  const { rowByCode } = useInvoiceIndex()

  const record = computed(() => resourceRecord?.record?.value || null)
  const code = computed(() => String(record.value?.Code || '').trim())

  /** The invoice's own payment rows, already joined by the shared index. */
  const payments = computed(() => rowByCode.value.get(code.value)?.payments || [])

  /** Billed, collected, outstanding and the suggested write-off — one Layer 2 call. */
  const gate = computed(() => settlementGate(record.value || {}, payments.value))

  const currencyCode = computed(() => invoiceCurrencyOf(record.value?.PriceListCode))
  const money = (value) => _C(Number(value) || 0, true, currencyCode.value)

  // `MarkPaid` is registered `kind: navigate`, so `setActions` has no request to attach a
  // value to and drops it. Writing a control re-cuts the live batch.
  const control = (key) => pageState?.getControls(key, undefined, NODE)
  const setControl = (key, value) => pageState?.setControls(key, value, NODE)

  const reason = computed(() => String(control('SettlementReason') || '').trim())
  const comment = computed(() => String(control('SettlementComment') || '').trim())

  /**
   * The raw control value, NOT coerced to a number: the card distinguishes an untouched
   * field from a deliberate blank, and `validateSettlement` reads a blank as "the whole
   * outstanding balance". The card auto-fills it from `gate.suggestedMismatch`.
   */
  const mismatch = computed(() => control('SettlementMismatchAmount'))

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
    progressMeta: computed(() => progressMetaOf(record.value)),

    reasons: computed(() => settlementReasons()),
    reason,
    comment,
    mismatch,
    commentRequired: computed(() => reason.value === SETTLEMENT_OTHER),

    setControl,
    /**
     * Called by the card in `setup()`: an action route's resolver fetches the invoice only,
     * so the payments the balance is derived from are opened here (§5.5).
     */
    hydrate: () => useRecord('OutletPayments')
  }
}
