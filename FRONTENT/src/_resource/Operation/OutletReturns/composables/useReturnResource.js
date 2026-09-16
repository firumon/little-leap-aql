import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'OutletReturns'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function useReturnResource () {
  const record = useRecord()

  const returnsOfInvoice = (invoiceCode) => {
    const key = text(invoiceCode)
    if (!key) return []
    return record.recordsBy(RESOURCE_NAME, 'ConsumptionInvoiceCode', key)
  }

  return {
    returnsOfInvoice
  }
}
