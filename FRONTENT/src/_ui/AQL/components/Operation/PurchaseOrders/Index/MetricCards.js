import {
  progressOf,
  countsForUser,
  canReceive,
  CREATED,
  SENT,
  ACKNOWLEDGED
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

// Open queues only: orders not yet sent, sent but unacknowledged, and awaiting goods.
export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      let notSent = 0
      let awaitingAck = 0
      let awaitingGoods = 0

      for (const row of records) {
        if (!countsForUser(row)) continue
        const progress = progressOf(row)
        if (progress === CREATED) notSent++
        else if (progress === SENT) awaitingAck++
        if (progress === ACKNOWLEDGED && canReceive(row)) awaitingGoods++
      }

      if (!notSent && !awaitingAck && !awaitingGoods) return []

      return [
        { label: 'Not Sent', number: notSent, color: 'grey-7' },
        { label: 'Awaiting Acknowledgement', number: awaitingAck, color: 'warning' },
        { label: 'Awaiting Goods', number: awaitingGoods, color: 'primary' }
      ]
    }
  }
}
