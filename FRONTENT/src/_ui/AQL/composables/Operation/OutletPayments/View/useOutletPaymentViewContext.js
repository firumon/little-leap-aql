import { ref, computed, inject } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import {
  isCancelled,
  progressMetaOf
} from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentProgress'
import {
  netInvoiceTotalOf,
  paidTotalOf,
  balanceDueOf
} from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentAllocation'
import { progressMetaOf as invoiceProgressMetaOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import {
  payableFiguresOf,
  payableLabel
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'

/**
 * OutletPayments › View — the injection relay for the View page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * ONE `inject()` for the five view sections, and the one place this page's imports of
 * `useResourceNav` / `useCurrencyResource` / the Layer 2 composables legally live.
 *
 * Every figure is READ from `useOutletPaymentIndex`, never re-derived: the balance this page
 * shows for the credited invoice is the same balance the Index queue showed a moment ago,
 * because it is the same computation (CORE_ARCHITECTURE_RULES §6).
 *
 * PLACEMENT — `View/`, the page tier (§6.2): only this page provides the context it injects.
 */

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The in-flight load, shared by every section that calls the relay during one page visit. */
let pending = null

export function useOutletPaymentViewContext () {
  const ui = useAQLConfig()
  const nav = useResourceNav()
  const { code } = useRouteConfig()
  const { _C } = useCurrencyResource()

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)

  const index = useOutletPaymentIndex()

  /**
   * The resources this page reads BESIDES its own.
   *
   * `OutletConsumptionInvoices` is required, not optional: the credited invoice's total, its
   * status and every other open invoice for the outlet come from it, and nothing on this route
   * fetches it. `Outlets` supplies the name the receipt is addressed to.
   */
  const sources = ['OutletConsumptionInvoices', 'Outlets'].map((name) => useRecord(name))
  const loadSources = () => Promise.all(sources.map((resource) => resource.reload()))

  if (!pending) {
    pending = loadSources().finally(() => { pending = null })
  }

  const saving = ref(false)

  const loading = computed(() => resourceRecord?.loading?.value ?? false)

  /**
   * The receipt.
   *
   * Preferred from the aggregate rather than from `resourceRecord`, because the aggregate row
   * carries the outlet's NAME and the derived `isCancelled` flag that the raw record does not.
   * The raw record is the fallback for the tick before the payments sync settles.
   */
  const record = computed(() => {
    const paymentCode = text(code.value)
    if (!paymentCode) return resourceRecord?.record?.value || null
    return index.paymentRows.value.find((row) => text(row.code) === paymentCode) ||
      resourceRecord?.record?.value ||
      null
  })

  const outletCode = computed(() => text(record.value?.OutletCode || record.value?.outletCode))
  const outletName = computed(() =>
    index.outletNameByCode.value.get(outletCode.value) || outletCode.value)

  const progressMeta = computed(() => progressMetaOf(record.value))
  const isPaymentCancelled = computed(() => !!record.value && isCancelled(record.value))

  // ── The credited invoice ────────────────────────────────────────────────────

  const invoiceCode = computed(() =>
    text(record.value?.OutletConsumptionInvoiceCode || record.value?.invoiceCode))

  const invoice = computed(() =>
    (invoiceCode.value ? index.invoiceByCode.value.get(invoiceCode.value) : null) || null)

  const invoiceRow = computed(() =>
    (invoiceCode.value ? index.invoiceRowByCode.value.get(invoiceCode.value) : null) || null)

  const invoiceTotal = computed(() => (invoice.value ? netInvoiceTotalOf(invoice.value) : 0))

  /** Every payment against the credited invoice, newest first. */
  const invoiceAllPayments = computed(() => {
    if (!invoiceCode.value) return []
    return [...(index.paymentsByInvoice.value.get(invoiceCode.value) || [])]
      .sort((a, b) => text(b.Date).localeCompare(text(a.Date)))
  })

  const invoicePaidSoFar = computed(() => paidTotalOf(invoiceAllPayments.value))

  const invoiceBalance = computed(() =>
    (invoice.value ? balanceDueOf(invoice.value, invoiceAllPayments.value) : 0))

  // ── The outlet's wider position ─────────────────────────────────────────────

  /** This outlet's other open invoices — everything still collectable besides this one. */
  const otherPendingInvoices = computed(() => {
    if (!outletCode.value) return []
    return index.openInvoices.value.filter((row) =>
      text(row.outletCode) === outletCode.value && text(row.code) !== invoiceCode.value)
  })

  /** The outlet's last ten receipts, this one excluded — it is the card above. */
  const recentPayments = computed(() => {
    if (!outletCode.value) return []
    const current = text(record.value?.Code || record.value?.code)
    return index.paymentRows.value
      .filter((row) => text(row.outletCode) === outletCode.value && text(row.code) !== current)
      .sort((a, b) => text(b.date).localeCompare(text(a.date)))
      .slice(0, 10)
  })

  return {
    ui,
    loading,
    saving,

    /** Evaluate a prop that may be a function of the record, exactly as a Section does. */
    evaluate: (value) => (typeof value === 'function'
      ? value(record.value, resourceConfig?.config?.value ?? null)
      : value),
    money: (value) => _C(num(value), true),

    record,
    outletCode,
    outletName,
    progressMeta,
    isPaymentCancelled,

    invoice,
    invoiceRow,
    invoiceCode,
    invoiceTotal,

    // A label, not a second calculation: the actual payable, printed on its own.
    invoiceTotalText: computed(() => payableLabel(payableFiguresOf(invoice.value || {}), (v) => _C(num(v), true))),
    invoicePaidSoFar,
    invoiceBalance,
    invoiceAllPayments,
    invoiceProgressMetaOf,

    otherPendingInvoices,
    recentPayments,

    /** Start a payment against one invoice, pre-loading the outlet and the invoice. */
    payInvoice: (invCode, outCode) => nav.goTo('add', {
      query: { outletCode: text(outCode) || outletCode.value, invoiceCode: text(invCode) }
    }),

    /** Open another receipt on this same page. */
    openPayment: (payCode) => {
      const next = text(payCode)
      if (next) nav.goTo('view', { code: next })
    },

    /** Open the credited invoice on its own resource. */
    openInvoice: () => {
      if (!invoiceCode.value) return
      nav.goTo('view', {
        scope: 'operation',
        resourceSlug: 'outlet-consumption-invoices',
        code: invoiceCode.value
      })
    }
  }
}
