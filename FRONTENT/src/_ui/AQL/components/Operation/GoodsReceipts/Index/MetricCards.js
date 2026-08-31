import { useDataStore } from 'src/stores/data'
import { isActiveRow, isInvalidated } from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptProgress'
import { goodsReceiptTotals } from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptPayload'

// Live receipts and the quantity they hold. An invalidated one posted nothing.
export default function (props, { resourceRecord }) {
  const dataStore = useDataStore()

  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const rows = dataStore.getRecords('GoodsReceiptItems')
      let live = 0
      let invalidated = 0
      let quantity = 0

      for (const row of records) {
        if (isInvalidated(row)) {
          invalidated++
          continue
        }
        if (!isActiveRow(row)) continue
        live++
        quantity += goodsReceiptTotals(row, rows).quantity
      }

      if (!live && !invalidated && !quantity) return []

      return [
        { label: 'Valid Receipts', number: live, color: 'positive' },
        { label: 'Units Posted', number: quantity, color: 'primary' },
        { label: 'Invalidated', number: invalidated, color: 'negative' }
      ]
    }
  }
}
