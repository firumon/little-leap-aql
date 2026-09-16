import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'RFQs'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function useRFQResource () {
  const record = useRecord()

  const getRFQ = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy(RESOURCE_NAME, 'Code', key)
  }

  const rfqOfProcurement = (procurementCode) => {
    const key = text(procurementCode)
    if (!key) return null
    return record.recordBy(RESOURCE_NAME, 'ProcurementCode', key)
  }

  return {
    getRFQ,
    rfqOfProcurement,
    rfqSupplierRows: () => record.enriched('RFQSuppliers')
  }
}
