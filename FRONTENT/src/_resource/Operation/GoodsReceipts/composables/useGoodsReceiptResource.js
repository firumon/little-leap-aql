import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'GoodsReceipts'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function useGoodsReceiptResource () {
  const record = useRecord()

  const goodsReceiptOfReceiving = (poReceivingCode) => {
    const key = text(poReceivingCode)
    if (!key) return null
    const rows = record.recordsBy(RESOURCE_NAME, 'POReceivingCode', key)
    return rows.find((row) => text(row?.Status || 'Active') === 'Active') || null
  }

  return {
    goodsReceiptOfReceiving,
    goodsReceiptItems: () => record.enriched('GoodsReceiptItems')
  }
}
