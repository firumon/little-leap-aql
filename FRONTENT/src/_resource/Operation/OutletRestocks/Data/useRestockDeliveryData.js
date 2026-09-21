/**
 * The delivery side of outlet restocks: approved work that has not fully reached
 * the outlet yet, and how long it has waited since the approval.
 *
 * Reads:
 *   OutletRestocks: Progress, Status, ProgressApprovedAt
 *
 * Exposes:
 *   loading       - true while OutletRestocks is loading and has no rows
 *   openCount     - restocks at APPROVED or PARTIALLY_DELIVERED (stock still owed)
 *   partialCount  - of those, how many are PARTIALLY_DELIVERED
 *   deliveryWait  - open restocks in 4 age bands, age from ProgressApprovedAt
 *   controls      - none
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { PARTIALLY_DELIVERED, progressOf, isActiveRow, isAwaitingDelivery, bandCounts } from './_shared'

export default function useRestockDeliveryData () {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince } = useDataContext()

  return remember('useRestockDeliveryData', () => {
    const loading = computed(() => isLoading('OutletRestocks') && rows('OutletRestocks').length === 0)

    const open = computed(() => rows('OutletRestocks').filter((r) => isActiveRow(r) && isAwaitingDelivery(r)))
    const openCount = computed(() => open.value.length)
    const partialCount = computed(() => open.value.filter((r) => progressOf(r) === PARTIALLY_DELIVERED).length)

    const deliveryWait = computed(() => bandCounts(open.value.map((r) => daysSince(r.ProgressApprovedAt))))

    const controls = []

    return { loading, openCount, partialCount, deliveryWait, controls }
  })
}
