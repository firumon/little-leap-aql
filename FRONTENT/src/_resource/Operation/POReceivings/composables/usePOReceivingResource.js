import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'POReceivings'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function usePOReceivingResource () {
  const record = useRecord()

  const receivingItemsOf = (receivingCode) => {
    const key = text(receivingCode)
    if (!key) return []
    return record.recordsBy('POReceivingItems', 'POReceivingCode', key)
  }

  const receivingsOfOrder = (orderCode) => {
    const key = text(orderCode)
    if (!key) return []
    return record.recordsBy(RESOURCE_NAME, 'PurchaseOrderCode', key)
  }

  return {
    receivingItemsOf,
    receivingsOfOrder
  }
}
