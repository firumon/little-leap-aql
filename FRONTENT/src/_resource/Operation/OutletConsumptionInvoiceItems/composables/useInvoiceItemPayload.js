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

// One sheet row. The parent code is NOT set here: a composite save fills it in from the
// invoice it just wrote, so no caller has to hold a code that does not exist yet.
export function invoiceItemRow (line) {
  return { ...invoiceItemOf(line), Status: 'Active' }
}

// The `children` bucket an invoice carries. A list, never a node: these rows are written
// inside the parent's composite. No bucket when empty, so a merge cannot wipe live lines.
export function nodePayloadForParent (lines = []) {
  const records = (Array.isArray(lines) ? lines : []).filter(Boolean).map(invoiceItemRow)
  return records.length ? [{ resource: RESOURCE_NAME, records }] : []
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
    nodePayloadForParent,
    changedInvoiceItemRows
  }
}
