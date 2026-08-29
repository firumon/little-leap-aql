import { textOrRef } from 'src/utils/appHelpers'

// The invoice's line rows. Their SHAPE lived in OutletConsumptions, which does not own
// them - a consumption discovers what is billable, an invoice item states what was billed.

export const RESOURCE_NAME = 'OutletConsumptionInvoiceItems'

// The money columns an edit compares. Listed here because the sheet owns them, so a
// column added to the row is added in one place.
export const ITEM_FIGURES = ['Price', 'Total', 'Discount', 'TaxableAmount', 'TaxAmount']

// A calculated line minus the engine's working fields. `TaxParts` is the per-component
// detail the header already carries grouped, and `Unpriced` is a flag, not a column.
export function invoiceItemOf (line) {
  const { TaxParts, Unpriced, ...record } = (line && typeof line === 'object' ? line : {})
  return record
}

export function invoiceItemRow (line, invoiceCode) {
  return {
    OutletConsumptionInvoiceCode: textOrRef(invoiceCode),
    ...invoiceItemOf(line),
    Status: 'Active'
  }
}

export function invoiceItemPermissions () {
  return { [RESOURCE_NAME]: 'create' }
}

// An empty list yields NO node - a bulk with no records is a wasted round trip.
export function buildInvoiceItemNodes (lines = [], invoiceCode = '') {
  const records = (Array.isArray(lines) ? lines : [])
    .filter(Boolean)
    .map((line) => invoiceItemRow(line, invoiceCode))
  if (!records.length) return [
    
  ]
  return [
    { resource: RESOURCE_NAME, many: true, records: records, reload: [RESOURCE_NAME] }
  ]
}

// The rows an EDIT rewrites, keyed by Code. Only lines whose figures actually moved, so
// an untouched invoice writes nothing.
export function changedInvoiceItemRows (storedItems = [], calculatedLines = [], sameMoney) {
  const text = (value) => (value == null ? '' : String(value).trim())
  const calculated = new Map((Array.isArray(calculatedLines) ? calculatedLines : [])
    .map((line) => [text(line.SKU), line]))

  return (Array.isArray(storedItems) ? storedItems : []).reduce((rows, item) => {
    const line = calculated.get(text(item.SKU))
    const code = text(item.Code)
    if (!line || !code) return rows
    const unchanged = ITEM_FIGURES.every((key) => sameMoney(item[key], line[key])) &&
      text(item.TaxCode) === text(line.TaxCode)
    if (unchanged) return rows
    rows.push({
      Code: code,
      ...ITEM_FIGURES.reduce((figures, key) => ({ ...figures, [key]: Number(line[key]) || 0 }), {}),
      TaxCode: text(line.TaxCode)
    })
    return rows
  }, [])
}

export function useInvoiceItemPayload () {
  return {
    RESOURCE_NAME,
    ITEM_FIGURES,
    invoiceItemOf,
    invoiceItemRow,
    invoiceItemPermissions,
    buildInvoiceItemNodes,
    changedInvoiceItemRows
  }
}
