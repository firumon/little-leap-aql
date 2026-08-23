import { useDataStore } from 'src/stores/data'
import { textOrRef } from 'src/utils/appHelpers'
import {
  resourceBulkRequest,
  resourceUpdateRequest
} from 'src/composables/resources/resourceRequests'

/**
 * TaxTransactions › the tax ledger — Layer 2, `accounts` scope.
 *
 * ── WHAT THIS SHEET IS FOR ──
 * A tax return is filed per TAX CODE over a period, across every document that charged it.
 * An invoice's own `TaxDetails` column answers that question for ONE invoice, as JSON, which
 * means answering it for a quarter would mean parsing every invoice in the tenant. This sheet
 * is the flat, queryable form: one row per document per tax code, at the grain
 * `Resource + ResourceCode + TaxCode` (FEATURE_TAX_SYSTEM.md §5).
 *
 * It is a LEDGER, not a second calculation. Every figure written here is lifted from the
 * grouped breakdown the one engine already produced for the document — this module does no
 * arithmetic of its own, so a tax return and the invoice it came from can never disagree.
 *
 * ── ZERO-RATED ROWS ARE WRITTEN ──
 * A 0% component still produces a row. That is deliberate and is the whole point of a
 * zero-rated classification (§7, Example 7): the business claims input credit against it, so
 * the return has to show the taxable value that was zero-rated, not a gap where a line used
 * to be. A blank tax code produces nothing, because an exempt item is out of scope entirely.
 *
 * PURE builders (UI_RESOURCE_DOMAIN_LOGIC.md §9.6): every row they need is an argument. The
 * one store read lives in `taxTransactionRowsOf`, which is a resource ACCESSOR rather than a
 * builder — the same split `useDeliveryRows.js` uses, and what lets a `PageAction.js` running
 * outside setup read the existing ledger rows without importing a store itself.
 */

const TAX_TRANSACTIONS = 'TaxTransactions'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

/** Every resource this module reads, so a page that needs it can load exactly that. */
export const TAX_TRANSACTION_RESOURCES = [TAX_TRANSACTIONS]

/**
 * The ledger rows a document currently owns.
 *
 * Reads the CACHE and never fetches, so a page that intends to REPLACE a document's rows must
 * have loaded the resource first — otherwise it sees none, writes a second set, and the
 * return double-counts. `useInvoiceEditContext` is what loads it for the Edit page.
 */
export function taxTransactionRowsOf (resource = '', resourceCode = '') {
  const name = text(resource)
  const code = text(resourceCode)
  if (!name || !code) return []
  return (useDataStore().getRecords(TAX_TRANSACTIONS) || [])
    .map(asRow)
    .filter((row) =>
      text(row.Resource) === name &&
      text(row.ResourceCode) === code &&
      text(row.Status || 'Active').toUpperCase() === 'ACTIVE')
}

/**
 * The ledger rows a document's grouped tax breakdown implies.
 *
 * `taxBreakdown` is the engine's own `[{ TaxCode, TaxableAmount, TaxAmount }]` — one entry per
 * tax COMPONENT, which is the grain a return is filed at, so a compound tax contributes a row
 * per component rather than one for its parent group.
 *
 * `resourceCode` may be a batch `$ref`: on a chained create the document does not have a code
 * yet, and `textOrRef` is what lets these rows point at the row the same batch is about to
 * write.
 */
export function buildTaxTransactionRequests ({
  resource = '',
  resourceCode = '',
  date = '',
  counterPartyType = '',
  counterPartyCode = '',
  taxBreakdown = [],
  accessRegion = ''
} = {}) {
  const name = text(resource)
  const entries = (Array.isArray(taxBreakdown) ? taxBreakdown : [])
    .map(asRow)
    .filter((entry) => text(entry.TaxCode))

  if (!name || !resourceCode || !entries.length) return { requests: [], permissions: {} }

  const rows = entries.map((entry) => ({
    Date: text(date) || todayISO(),
    Resource: name,
    ResourceCode: textOrRef(resourceCode),
    CounterPartyType: text(counterPartyType),
    CounterPartyCode: text(counterPartyCode),
    TaxCode: text(entry.TaxCode),
    TaxableAmount: num(entry.TaxableAmount),
    TaxAmount: num(entry.TaxAmount),
    AccessRegion: text(accessRegion),
    Status: 'Active'
  }))

  return {
    requests: [resourceBulkRequest(TAX_TRANSACTIONS, rows, [TAX_TRANSACTIONS])],
    permissions: { taxTransaction: 'create' }
  }
}

/**
 * Retire a document's ledger rows.
 *
 * DEACTIVATED, never deleted. A tax return that has already been filed against these figures
 * has to stay reconstructable, and a soft-deleted row keeps the audit stamps that say who
 * withdrew it and when — which a removed row cannot.
 */
export function buildTaxTransactionReversalRequests ({ existingRows = [] } = {}) {
  const rows = (Array.isArray(existingRows) ? existingRows : [])
    .map(asRow)
    .filter((row) => text(row.Code))

  if (!rows.length) return { requests: [], permissions: {} }

  return {
    requests: rows.map((row) => resourceUpdateRequest(TAX_TRANSACTIONS, text(row.Code), {
      Status: 'Inactive'
    }, [TAX_TRANSACTIONS])),
    permissions: { taxTransaction: 'update' }
  }
}

/**
 * Re-state a document's ledger after its figures changed: retire what is there, write what is
 * now true.
 *
 * REPLACE rather than update-in-place, because an edit can change the SET of tax codes and not
 * just their amounts — a re-priced line that moves a SKU under a different tax, or a price
 * list switch that changes the policy, leaves a code with no counterpart on the other side.
 * Matching them up would be a merge; retiring and re-writing is the same answer with no
 * partial states, and it leaves the superseded figures readable.
 */
export function buildTaxTransactionReplacementRequests ({
  existingRows = [],
  ...creation
} = {}) {
  const reversal = buildTaxTransactionReversalRequests({ existingRows })
  const fresh = buildTaxTransactionRequests(creation)

  return {
    requests: [...reversal.requests, ...fresh.requests],
    permissions: { ...reversal.permissions, ...fresh.permissions }
  }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useTaxTransactionPayload () {
  return {
    TAX_TRANSACTIONS,
    TAX_TRANSACTION_RESOURCES,
    taxTransactionRowsOf,
    buildTaxTransactionRequests,
    buildTaxTransactionReversalRequests,
    buildTaxTransactionReplacementRequests
  }
}
