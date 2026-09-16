import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'SupplierQuotations'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function useSupplierQuotationResource () {
  const record = useRecord()

  const getSupplierQuotation = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy(RESOURCE_NAME, 'Code', key)
  }

  const quotationItemsOf = (quotationCode) => {
    const key = text(quotationCode)
    if (!key) return []
    return record.recordsBy('SupplierQuotationItems', 'SupplierQuotationCode', key)
  }

  return {
    getSupplierQuotation,
    quotationItemsOf
  }
}
