import {
  progressOf,
  isActiveRow,
  isTerminal,
  PR_APPROVED,
  QUOTATIONS_RECEIVED,
  GOODS_RECEIVING
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'

// The three places a procurement waits on a person rather than on a supplier.
export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      let awaitingSourcing = 0
      let awaitingOrder = 0
      let awaitingReceipt = 0

      for (const row of records) {
        if (!isActiveRow(row) || isTerminal(row)) continue
        const progress = progressOf(row)
        if (progress === PR_APPROVED) awaitingSourcing++
        else if (progress === QUOTATIONS_RECEIVED) awaitingOrder++
        else if (progress === GOODS_RECEIVING) awaitingReceipt++
      }

      if (!awaitingSourcing && !awaitingOrder && !awaitingReceipt) return []

      return [
        { label: 'Awaiting RFQ', number: awaitingSourcing, color: 'warning' },
        { label: 'Awaiting Order', number: awaitingOrder, color: 'primary' },
        { label: 'Awaiting Goods Receipt', number: awaitingReceipt, color: 'info' }
      ]
    }
  }
}
