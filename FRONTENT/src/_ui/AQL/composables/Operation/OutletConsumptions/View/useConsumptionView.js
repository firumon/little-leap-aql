import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useConsumptionViewContext } from './useConsumptionViewContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import {
  progressOf,
  isActiveRow,
  findInvoiceFor,
  consumptionCodesOf,
  cancellability,
  relatedLabel,
  relatedColor,
  relatedIcon,
  progressLabel,
  progressColor,
  progressIcon,
  workflowStamps
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

/**
 * OutletConsumptions › View — the read-only aggregate behind the six View cards.
 *
 * PRESENTATION ONLY (UI_RESOURCE_DOMAIN_LOGIC.md §4). Every predicate, colour and label is
 * READ from Layer 2 — the invoice match, the cancellation gate and the whole progress
 * vocabulary all resolve there — so this page renders the workflow rather than restating
 * it.
 *
 * ONE REACTIVE SOURCE OF TRUTH (CORE_ARCHITECTURE_RULES §6). Every card on the page reads a
 * projection of the same derived tree, which is why "what was consumed" and "what is being
 * replenished" can never disagree on screen (§7.4).
 *
 * Page-scoped per §6.1: it calls `inject()` through the relay, and only `View.js` resolves
 * its cards.
 *
 * Nothing here mutates. The View page is a statement of what happened; the one action that
 * changes it lives on the `cancel-consumption` route.
 */

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The one vocabulary, under the names this page's cards import (§3.3's extension shape). */
export { relatedLabel, relatedColor, relatedIcon, progressLabel, progressColor, progressIcon, workflowStamps }

/** `2026-08-15` → `15 Aug 2026`. Blank stays blank. */
export function formatDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function useConsumptionView () {
  // Injected once for the whole page, by the relay — not a second time here.
  const { resourceRecord } = useConsumptionViewContext()

  const items = useRecord('OutletConsumptionItems')
  const invoices = useRecord('OutletConsumptionInvoices')
  const restocks = useRecord('OutletRestocks')
  const restockItems = useRecord('OutletRestockItems')
  const returns = useRecord('OutletReturns')
  const consumptions = useRecord('OutletConsumptions')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')
  const outlets = useRecord('Outlets')
  const uoms = useRecord('UOMs')

  // The SKU × Product and Outlet joins belong to the resource layer (§6 — Enrich Once,
  // Then Project). The `useRecord` handles stay for their `reload()` below: fetching rows
  // is a separate concern from reading them.
  const { getSku } = useSkuResource()
  const { getOutlet } = useOutletResource()

  onMounted(() => {
    // A view route loads the record and its relations, but NOT the sibling resources
    // these cards project over. `reload()` renders from whatever the store already holds
    // and syncs the delta in the background, so a warm cache shows the page immediately.
    ;[items, invoices, restocks, restockItems, returns, consumptions, skus, products, outlets, uoms]
      .forEach((resource) => resource.reload())
  })

  const record = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !record.value && loading.value)
  const code = computed(() => text(record.value?.Code))
  const outletCode = computed(() => text(record.value?.OutletCode))

  const outletName = computed(() => text(getOutlet(outletCode.value)?.name) || outletCode.value)

  /**
   * Resolves SKU display information via O(1) Map lookup (CORE_ARCHITECTURE_RULES §6).
   * Reads from the shared, app-wide enriched SKU graph in `useSkuResource()`.
   */
  function skuLabel (sku) {
    const raw = text(sku)
    const info = asRow(getSku(raw))
    const variants = (info.variantValues || []).filter(Boolean).join(' / ')
    const uom = text(info.uom || info.baseUom || '')
    return { primary: text(info.productName) || raw, secondary: variants || raw, uom }
  }

  /** Section 2 — the SKUs this audit consumed. */
  const consumedItems = computed(() => {
    if (!code.value) return []
    return items.items.value
      .map(asRow)
      .filter((row) => text(row.OutletConsumptionCode) === code.value && isActiveRow(row) && text(row.Code))
      .map((row) => {
        const label = skuLabel(row.SKU)
        const q = num(row.Qty)
        const unit = label.uom || 'Qty'
        return {
          code: text(row.Code),
          sku: text(row.SKU),
          name: label.primary,
          variant: label.secondary,
          qty: q,
          uom: label.uom,
          qtyWithUom: `${q} ${unit}`
        }
      })
  })

  const consumedTotal = computed(() => consumedItems.value.reduce((sum, row) => sum + row.qty, 0))

  /** Section 3 — restock requests this audit raised, as a FLAT list of their line items. */
  const linkedRestocks = computed(() => restocks.items.value
    .map(asRow)
    .filter((row) => isActiveRow(row) && text(row.OutletConsumptionCode) === code.value))

  const restockLines = computed(() => {
    const parentCodes = new Set(linkedRestocks.value.map((row) => text(row.Code)))
    if (!parentCodes.size) return []
    // Flat, deliberately: the directive's contract asks for line items, not a nested
    // request→item tree. A phone row has no width for two levels of grouping, and the
    // request's own state is already carried by its lines' states.
    return restockItems.items.value
      .map(asRow)
      .filter((row) => isActiveRow(row) && parentCodes.has(text(row.OutletRestockCode)) && text(row.Code))
      .map((row) => {
        const label = skuLabel(row.SKU)
        const q = num(row.Quantity)
        const unit = label.uom || 'Qty'
        return {
          code: text(row.Code),
          restockCode: text(row.OutletRestockCode),
          sku: text(row.SKU),
          name: label.primary,
          variant: label.secondary,
          qty: q,
          uom: label.uom,
          qtyWithUom: `${q} ${unit}`,
          progress: text(row.Progress) || 'PENDING'
        }
      })
  })

  /**
   * Section 4 — the invoice covering this audit.
   *
   * Matched by MEMBERSHIP in the invoice's comma-separated `OutletConsumptionCode`, never
   * by equality: a bundled invoice names several codes in that column, and an equality
   * test would report "no invoice" for exactly the audits bundling exists to combine.
   */
  const invoice = computed(() => findInvoiceFor(record.value, invoices.items.value))

  const invoiceSiblings = computed(() => {
    if (!invoice.value) return []
    return consumptionCodesOf(invoice.value).filter((entry) => entry !== code.value)
  })

  /** Section 5 — returns raised at this outlet on this audit's date. */
  const outletReturns = computed(() => {
    if (!outletCode.value) return []
    const date = text(record.value?.Date)
    return returns.items.value
      .map(asRow)
      .filter((row) => isActiveRow(row) && text(row.OutletCode) === outletCode.value && text(row.Date) === date)
      .map((row) => {
        const label = skuLabel(row.SKU)
        const q = num(row.Qty)
        const unit = label.uom || 'Qty'
        return {
          code: text(row.Code),
          name: label.primary,
          variant: label.secondary,
          qty: q,
          uom: label.uom,
          qtyWithUom: `${q} ${unit}`,
          reason: text(row.Reason),
          progress: text(row.Progress),
          warehouseCode: text(row.WarehouseCode)
        }
      })
  })

  /** Section 6 — up to five other recent audits at the same outlet. */
  const recentConsumptions = computed(() => {
    if (!outletCode.value) return []
    return consumptions.items.value
      .map(asRow)
      .filter((row) => isActiveRow(row) && text(row.OutletCode) === outletCode.value && text(row.Code) !== code.value)
      .slice()
      .sort((a, b) => (text(a.Date) < text(b.Date) ? 1 : -1))
      .slice(0, 5)
      .map((row) => ({
        code: text(row.Code),
        date: text(row.Date),
        username: text(row.Username),
        progress: progressOf(row)
      }))
  })

  /**
   * Whether this audit may still be cancelled, and the reason when it may not.
   *
   * The predicate is Layer 2's; this only supplies the dependents it needs. The View card
   * SAYS the reason rather than silently hiding the button — an action that vanishes with
   * no explanation reads as a bug.
   */
  const cancelGate = computed(() => cancellability(record.value, {
    invoice: invoice.value,
    restocks: linkedRestocks.value
  }))

  const events = computed(() => workflowStamps(record.value))

  return {
    record, pending, loading, code, outletCode, outletName,
    consumedItems, consumedTotal,
    linkedRestocks, restockLines,
    invoice, invoiceSiblings,
    outletReturns,
    recentConsumptions,
    cancelGate,
    events,
    skuLabel, formatDate,
    relatedLabel, relatedColor, relatedIcon,
    progressLabel, progressColor, progressIcon
  }
}
