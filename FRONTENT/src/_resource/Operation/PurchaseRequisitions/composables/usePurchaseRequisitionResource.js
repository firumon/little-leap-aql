import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'PurchaseRequisitions'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function usePurchaseRequisitionResource () {
  const record = useRecord()

  const getPurchaseRequisition = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy(RESOURCE_NAME, 'Code', key)
  }

  const getRequisitionItem = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy('PurchaseRequisitionItems', 'Code', key)
  }

  const requisitionItemsByCodes = (codes) => {
    if (!Array.isArray(codes)) return []
    return codes.map(getRequisitionItem).filter(Boolean)
  }

  return {
    getPurchaseRequisition,
    getRequisitionItem,
    requisitionItemsByCodes
  }
}
