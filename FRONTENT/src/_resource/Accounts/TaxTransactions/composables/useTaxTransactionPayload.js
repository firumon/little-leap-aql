import { useDataStore } from 'src/stores/data'
import { textOrRef } from 'src/utils/appHelpers'
import {
  resourceBulkRequest,
  resourceUpdateRequest
} from 'src/composables/resources/resourceRequests'

/**
 * The tax ledger: one row per document per tax code, so a return can be filed without
 * parsing every invoice's `TaxDetails` JSON. Figures are lifted from the engine's grouped
 * breakdown — no arithmetic here.
 */

const TAX_TRANSACTIONS = 'TaxTransactions'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

export const TAX_TRANSACTION_RESOURCES = [TAX_TRANSACTIONS]

/**
 * Reads the CACHE and never fetches. A page that means to REPLACE a document's rows must
 * load the resource first, or it sees none and writes a second set.
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
 * A zero-rated component still writes a row — the return has to show the value that was
 * zero-rated. A blank tax code writes none: an exempt item is out of scope.
 *
 * `resourceCode` may be a batch `$ref`, so these can chain off a document the same batch
 * is creating.
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

/** Deactivated, never deleted: a filed return must stay reconstructable. */
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
 * Replace rather than update in place: an edit can change the SET of tax codes, not just
 * the amounts, so there is no row to match against.
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
