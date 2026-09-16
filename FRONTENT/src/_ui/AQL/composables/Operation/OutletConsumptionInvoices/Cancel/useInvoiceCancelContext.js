import { inject, computed, onMounted, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { grandTotalOf, invoiceCurrencyOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  canCancelInvoice,
  isCancelled,
  isPaid,
  progressOf,
  progressMetaOf,
  PARTIALLY_PAID,
  PAID
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { buildCancellationNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { consumptionCodesOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { taxTransactionRowsOf } from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'
import { useReturnResource } from 'src/_resource/Operation/OutletReturns/composables/useReturnResource'

// OutletConsumptionInvoices > Cancel - the one inject() behind the three cards, and the
// route's own hydration point. `CANCEL_COMMENT` is working state: the builder stamps it
// onto the Cancel action, so it is never a column of its own.

export const NODE = 'OutletConsumptionInvoices'
export const CANCEL_COMMENT = 'CancelComment'

const SOURCES = [
  'OutletConsumptions', 'OutletConsumptionItems', 'OutletReturns', 'TaxTransactions', 'Outlets'
]

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

export function useInvoiceCancelContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)

  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()
  const index = useInvoiceIndex()
  const { returnsOfInvoice } = useReturnResource()

  const record = computed(() => resourceRecord?.record?.value || null)
  const code = computed(() => text(record.value?.Code))

  const money = (value) => _C(num(value), true, invoiceCurrencyOf(record.value?.PriceListCode))

  const progressMeta = computed(() => progressMetaOf(record.value))
  const eligible = computed(() => !!record.value && canCancelInvoice(record.value))
  const hasPayments = computed(() => [PAID, PARTIALLY_PAID].includes(progressOf(record.value)))

  const blockedMessage = computed(() => {
    const row = record.value
    if (!row || eligible.value) return ''
    if (isCancelled(row)) return 'This invoice is already cancelled.'
    if (hasPayments.value || isPaid(row)) {
      return 'Payments exist against this invoice, so it cannot be cancelled.'
    }
    return 'This invoice can no longer be cancelled.'
  })

  const outletName = computed(() =>
    index.outletNameByCode.value.get(text(record.value?.OutletCode)) || text(record.value?.OutletCode))

  const netPayable = computed(() => grandTotalOf(record.value || {}))

  const consumptionCodes = computed(() => consumptionCodesOf(record.value || {}))

  /** One row per bundled consumption, with what it counted. */
  const consumptions = computed(() => {
    const chosen = new Set(consumptionCodes.value)
    if (!chosen.size) return []
    return index.consumptions.value
      .filter((row) => chosen.has(text(row.Code)))
      .map((row) => {
        const items = index.itemsOfConsumption(row.Code)
        return {
          code: text(row.Code),
          date: text(row.Date),
          username: text(row.Username),
          itemCount: items.length,
          totalQty: items.reduce((sum, item) => sum + num(item.Qty), 0),
          // The stamp carries a real time; the date column alone would read as midnight.
          at: text(row.ProgressPendingInvoiceGenerationAt) || text(row.Date)
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  })

  /** The returns this invoice credited — the rows the cancellation hands back. */
  const returnRows = computed(() => returnsOfInvoice(code.value))

  const comment = computed({
    get: () => text(pageState?.getControls(CANCEL_COMMENT, '', NODE)),
    set: (value) => pageState?.setControls(CANCEL_COMMENT, text(value), NODE)
  })

  return {
    pageState,
    resourceRecord,
    ui,
    money,
    record,
    code,
    progressMeta,
    eligible,
    hasPayments,
    blockedMessage,
    outletName,
    netPayable,
    consumptionCodes,
    consumptions,
    returnRows,
    comment
  }
}

// The route's ONE hydration point (§13.7). Called by a single card, or the batch would be
// rebuilt once per card that called it.
export function useInvoiceCancelSeed () {
  const context = useInvoiceCancelContext()
  const { pageState, record, code, comment } = context
  const { user } = useAuth()
  const sources = SOURCES.map((name) => usePageRecord(name))
  const creditedReturns = usePageRecord('OutletReturns')

  onMounted(() => { sources.forEach((resource) => resource.reload()) })

  // The batch stands as soon as the invoice is here; the rows and the typed reason only
  // re-cut it. Submit then sends what is already standing.
  watch([record, comment, creditedReturns.items], () => {
    const row = record.value
    if (!pageState || !code.value) return

    const kept = comment.value
    if (!canCancelInvoice(row)) return

    pageState.resetForResource(NODE)
    pageState.initResource(NODE, { code: code.value, isPrimaryKey: true })
    pageState.setControls(CANCEL_COMMENT, kept, NODE)

    pageState.applyNodes(buildCancellationNodes({
      record: row,
      comment: kept,
      actorName: text(user.value?.name || user.value?.email),
      returnRows: context.returnRows.value,
      taxTransactionRows: taxTransactionRowsOf(NODE, code.value)
    }))
  }, { immediate: true })

  return context
}
