/**
 * Open work on outlet returns: returns waiting for invoice credit adjustment,
 * returns waiting for warehouse intake action, and how long open returns have waited.
 *
 * Reads:
 *   OutletReturns: Date, Qty, Price, Progress, Status,
 *                  InvoiceAdjustmentRequired, InvoiceAdjustmentDone,
 *                  WarehouseActionRequired, WarehouseActionCompleted
 *
 * Exposes:
 *   loading                - true while OutletReturns is loading and has no rows
 *   openCount              - total count of active open returns
 *   awaitingCreditCount    - count of open returns with invoice credit required and not done
 *   awaitingCreditTotal    - total money value of returns awaiting invoice credit
 *   awaitingWarehouseCount - count of open returns with warehouse action required and not done
 *   awaitingWarehouseUnits - total quantity of units awaiting warehouse action
 *   openAgeing             - open returns split across 4 age bands from return Date
 *   controls               - empty array
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import {
  isActiveRow,
  isOpen,
  invoiceAdjustmentRequired,
  invoiceAdjustmentDone,
  warehouseActionRequired,
  warehouseActionCompleted,
  returnValueOf,
  bandCounts
} from './_shared'

export default function useReturnWorkData () {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince } = useDataContext()

  return remember('useReturnWorkData', () => {
    const loading = computed(() => isLoading('OutletReturns') && rows('OutletReturns').length === 0)

    const active = computed(() => rows('OutletReturns').filter(isActiveRow))
    const open = computed(() => active.value.filter(isOpen))
    const openCount = computed(() => open.value.length)

    const awaitingCredit = computed(() =>
      open.value.filter((r) => invoiceAdjustmentRequired(r) && !invoiceAdjustmentDone(r)))
    const awaitingCreditCount = computed(() => awaitingCredit.value.length)
    const awaitingCreditTotal = computed(() =>
      awaitingCredit.value.reduce((sum, r) => sum + returnValueOf(r), 0))

    const awaitingWarehouse = computed(() =>
      open.value.filter((r) => warehouseActionRequired(r) && !warehouseActionCompleted(r)))
    const awaitingWarehouseCount = computed(() => awaitingWarehouse.value.length)
    const awaitingWarehouseUnits = computed(() =>
      awaitingWarehouse.value.reduce((sum, r) => sum + (Number(r.Qty) || 0), 0))

    const openAgeing = computed(() =>
      bandCounts(open.value.map((r) => daysSince(r.Date))))

    const controls = []

    return {
      loading,
      openCount,
      awaitingCreditCount,
      awaitingCreditTotal,
      awaitingWarehouseCount,
      awaitingWarehouseUnits,
      openAgeing,
      controls
    }
  })
}
