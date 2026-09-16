import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'PurchaseOrders'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function usePurchaseOrderResource () {
  const record = useRecord()

  const getPurchaseOrder = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy(RESOURCE_NAME, 'Code', key)
  }

  const orderItemsOf = (orderCode) => {
    const key = text(orderCode)
    if (!key) return []
    return record.recordsBy('PurchaseOrderItems', 'PurchaseOrderCode', key)
  }

  return {
    getPurchaseOrder,
    orderItemsOf,
    purchaseOrders: () => record.enriched(RESOURCE_NAME),
    purchaseOrderItems: () => record.enriched('PurchaseOrderItems')
  }
}
