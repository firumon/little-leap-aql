import {
  progressOf,
  countsForUser,
  CLOSED,
  COMPLETED,
  GRN_GENERATED,
  GOODS_RECEIVING,
  ACCEPTED,
  ACKNOWLEDGED,
  SENT
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

// Closure rate over orders that actually went to a supplier. Drafts and cancellations
// never became a real obligation.
const CLOSED_STATES = [CLOSED, COMPLETED, GRN_GENERATED]
const OPEN_STATES = [SENT, ACKNOWLEDGED, ACCEPTED, GOODS_RECEIVING]

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      let closed = 0
      let open = 0

      for (const row of records) {
        if (!countsForUser(row)) continue
        const progress = progressOf(row)
        if (CLOSED_STATES.includes(progress)) closed++
        else if (OPEN_STATES.includes(progress)) open++
      }

      const total = closed + open
      if (!total) return []

      return [{ label: 'Orders Fulfilled', value: closed, max: total, color: 'positive', unit: 'orders' }]
    }
  }
}
