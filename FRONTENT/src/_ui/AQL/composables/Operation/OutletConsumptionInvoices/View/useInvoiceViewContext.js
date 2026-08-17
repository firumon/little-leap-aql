import { inject, computed } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import {
  storedTaxBreakdown,
  invoicePolicyOf,
  invoiceCurrencyOf
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  progressMetaOf,
  settlementOf,
  canRecordPayment,
  canMarkPaid,
  canCancelInvoice,
  isPaid,
  isCancelled
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

/**
 * OutletConsumptionInvoices › View — the injection relay for the whole page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * ONE `inject()` for the six cards this page stacks. Every `.vue` under `View/` calls this
 * instead of injecting directly, and none of them imports a Core Composable, a store or a
 * domain module of its own — that is the entire import contract of §6.
 *
 * PLACEMENT — `View/`, the page tier (§6.2): only this page provides the context it injects.
 *
 * It DERIVES nothing itself. Every figure below is read off Layer 2 — the balance from the
 * shared index (which owns the payments join), the tax breakdown, the policy, the settlement
 * and all four gates from their domain modules. A `computed()` here that re-summed payments
 * or re-parsed `TaxDetails` would be a second implementation of a solved rule, arrived at by
 * the slowest possible route (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
 */
export function useInvoiceViewContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const pageState = inject('pageState', null)

  const nav = useResourceNav()
  const { _C } = useCurrencyResource()
  // The ONE naming rule for a SKU, read from the SKUs domain rather than restated here
  // (UI_RESOURCE_DOMAIN_LOGIC.md §3.3).
  const { skuLabelOf } = useSkuResource()
  const { rowByCode, outletNameByCode, invoiceRows } = useInvoiceIndex()

  const record = computed(() => resourceRecord?.record?.value || null)
  const code = computed(() => String(record.value?.Code || '').trim())

  /**
   * The invoice's aggregate row — balance, collected total and its own payments, already
   * joined. Read from the shared index rather than recomputed, so this page and the Index
   * list it was opened from show the same balance by construction.
   */
  const row = computed(() => rowByCode.value.get(code.value) || null)

  const items = computed(() => {
    const children = record.value?.$OutletConsumptionInvoiceItems
    return (Array.isArray(children) ? children : [])
      .filter((item) => String(item?.Status || 'Active').toUpperCase() === 'ACTIVE')
  })

  const outletName = computed(() => {
    const outletCode = String(record.value?.OutletCode || '').trim()
    return outletNameByCode.value.get(outletCode) || outletCode
  })

  /** Other live invoices for the same outlet, most recent first — the outlet context card. */
  const outletInvoices = computed(() => {
    const outletCode = String(record.value?.OutletCode || '').trim()
    if (!outletCode) return []
    return invoiceRows.value
      .filter((entry) => entry.outletCode === outletCode && entry.code !== code.value)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5)
  })

  /** The same outlet's recent payments across all its invoices. */
  const outletPayments = computed(() => {
    const outletCode = String(record.value?.OutletCode || '').trim()
    if (!outletCode) return []
    return invoiceRows.value
      .filter((entry) => entry.outletCode === outletCode)
      .flatMap((entry) => entry.payments.map((payment) => ({ ...payment, invoiceCode: entry.code })))
      .sort((a, b) => (String(a.Date) < String(b.Date) ? 1 : -1))
      .slice(0, 5)
  })

  const currencyCode = computed(() => invoiceCurrencyOf(record.value?.PriceListCode))
  const money = (value) => _C(Number(value) || 0, true, currencyCode.value)

  return {
    pageState,
    // The two handles every card needs for its own `[String, Function]` props, plus the
    // tenant's card styling — the same pair `useRestockViewContext` exposes.
    evaluate: (value) => evaluateProp(value, resourceRecord, resourceConfig),
    ui: useAQLConfig(),
    config: computed(() => resourceConfig?.config?.value || null),
    record,
    code,
    row,
    items,
    outletName,
    outletInvoices,
    outletPayments,
    money,
    skuLabelOf,

    balance: computed(() => row.value?.balance ?? 0),
    collected: computed(() => row.value?.collected ?? 0),
    grandTotal: computed(() => row.value?.total ?? 0),
    payments: computed(() => row.value?.payments || []),

    progressMeta: computed(() => progressMetaOf(record.value)),
    taxBreakdown: computed(() => storedTaxBreakdown(record.value || {})),
    policy: computed(() => invoicePolicyOf(record.value?.PriceListCode)),
    settlement: computed(() => settlementOf(record.value || {})),

    canPay: computed(() => canRecordPayment(record.value)),
    canSettle: computed(() => canMarkPaid(record.value)),
    canCancel: computed(() => canCancelInvoice(record.value)),
    isPaid: computed(() => isPaid(record.value)),
    isCancelled: computed(() => isCancelled(record.value)),

    /**
     * `Make Payment` — the one navigation this page performs that a GAS `navigate` action
     * could not express: it carries a QUERY (`invoiceCode`, `outletCode`) so the payments
     * Add page opens pre-filled, and `navigate.target` supports only `code`/`pageSlug`
     * params (UI_ACTION_SYSTEM.md §7.0.1a). That is why it is a Layer 3 button rather than
     * an `AdditionalActions` entry.
     */
    /** Open a sibling invoice of the same outlet from the context card. */
    openInvoiceByCode: (target) => {
      const next = String(target || '').trim()
      if (next) nav.goTo('view', { code: next })
    },

    goToPayment: () => nav.goTo('add', {
      scope: 'operation',
      resourceSlug: 'outlet-payments',
      query: { invoiceCode: code.value, outletCode: String(record.value?.OutletCode || '').trim() }
    })
  }
}

