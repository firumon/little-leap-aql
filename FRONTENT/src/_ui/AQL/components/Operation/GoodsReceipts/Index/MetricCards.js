import { isActiveRow, isInvalidated } from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptProgress'
import { goodsReceiptTotals } from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptPayload'

// Live receipts and the quantity they hold. An invalidated one posted nothing.
export default function (props, { resourceRecord }) {

  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

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
        const childRows = row.$GoodsReceiptItems || row.$goodsreceiptitems || []
        quantity += goodsReceiptTotals(row, childRows).quantity
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
