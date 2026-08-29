import { useDataStore } from 'src/stores/data'
import { textOrRef } from 'src/utils/appHelpers'

// The tax ledger: one row per document per tax code, so a return can be filed without
// parsing every invoice's TaxDetails JSON. No arithmetic here.

const TAX_TRANSACTIONS = 'TaxTransactions'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

export const TAX_TRANSACTION_RESOURCES = [TAX_TRANSACTIONS]

// Reads the CACHE and never fetches. A page replacing a document's rows must load the
// resource first, or it sees none and writes a second set.
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

// A zero-rated component still writes a row, but a blank tax code writes none - an exempt
// item is out of scope. resourceCode may be a $ref to a document this batch is creating.
export function buildTaxTransactionNodes ({
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

  if (!name || !resourceCode || !entries.length) return [
    
  ]

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

  return [
    { resource: TAX_TRANSACTIONS, many: true, records: rows, reload: [TAX_TRANSACTIONS],
      permissions: { create: 'You are not allowed to create this tax transaction.' }
    }
  ]
}

// Deactivated, never deleted: a filed return must stay reconstructable.
export function buildTaxTransactionReversalNodes ({ existingRows = [] } = {}) {
  const rows = (Array.isArray(existingRows) ? existingRows : [])
    .map(asRow)
    .filter((row) => text(row.Code))

  if (!rows.length) return [
    
  ]

  // One bulk, not one update per row: they all address the same resource, and a node is
  // addressed by resource.
  return [
    { resource: TAX_TRANSACTIONS, many: true, records: rows.map((row) => ({
      Code: text(row.Code),
      Status: 'Inactive'
    })), reload: [TAX_TRANSACTIONS],
      permissions: { update: 'You are not allowed to update this tax transaction.' }
    }
  ]
}

// Replace rather than update in place: an edit can change the SET of tax codes, not just
// the amounts, so there is no row to match against.
export function buildTaxTransactionReplacementNodes ({
  existingRows = [],
  ...creation
} = {}) {
  const reversal = buildTaxTransactionReversalNodes({ existingRows })
  const fresh = buildTaxTransactionNodes(creation)

  return [
    ...reversal,
    ...fresh
  ]
}

export function useTaxTransactionPayload () {
  return {
    TAX_TRANSACTIONS,
    TAX_TRANSACTION_RESOURCES,
    taxTransactionRowsOf,
    buildTaxTransactionNodes,
    buildTaxTransactionReversalNodes,
    buildTaxTransactionReplacementNodes
  }
}
