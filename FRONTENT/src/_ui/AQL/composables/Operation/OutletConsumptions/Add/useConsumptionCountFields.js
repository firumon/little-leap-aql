import { computed } from 'vue'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { consumptionItemRow } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
import { soldQty, returnQty, defaultRestockQty } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { returnRow, returnsNode } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { restockNode, restockItemRow, restockRoutingOf } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { NODE } from './nodes'

// The step-2 write surface. Holds NO state: every read is a live node read and every
// setter writes one column. Each row card calls it for its own SKU.

const text = (value) => (value == null ? '' : String(value).trim())
const positive = (value) => Math.max(0, Number(value) || 0)

export function useConsumptionCountFields (pageState, options = {}) {
  const returnsAllowed = options.returnsAllowed !== false
  const restocksAllowed = options.restocksAllowed !== false

  const { stockOf } = useOutletStorageResource()

  const outletCode = pageState.useRecord('OutletCode', NODE.CONSUMPTION)
  const indexBySku = pageState.useChildrenIndex(NODE.ITEMS, 'SKU')
  const returnIndexBySku = pageState.useRecordsIndex('SKU', NODE.RETURNS)
  const restockIndexBySku = pageState.useChildrenIndex(NODE.RESTOCK_ITEMS, 'SKU', NODE.RESTOCKS)

  // What the system says is on the shelf. A fact about the outlet, never a stored answer.
  const systemQtyOf = (sku) => stockOf(outletCode.value, text(sku))

  function setSoldQty (code, qty) {
    const index = indexBySku.value[code]
    if (index !== undefined) return pageState.setChildren(NODE.ITEMS, index, 'Qty', qty, NODE.CONSUMPTION)
    if (qty > 0) pageState.addChild(NODE.ITEMS, consumptionItemRow({ SKU: code, Qty: qty }), NODE.CONSUMPTION)
  }

  // A many-node is opened through its own Layer 2 builder, never a bare addRecord onto
  // nothing.
  function addReturn (code, qty) {
    if (!returnsAllowed) return
    const row = returnRow({ SKU: code, Qty: qty }, { OutletCode: outletCode.value })
    if (pageState.hasNode(NODE.RETURNS)) return pageState.addRecord(row, NODE.RETURNS)
    pageState.setResource(NODE.RETURNS, null, returnsNode([row]))
  }

  // A return back at zero KEEPS its record. Zero rows are dropped on the step transition.
  function setReturnQty (code, qty) {
    if (!returnsAllowed) return
    const index = returnIndexBySku.value[code]
    if (index !== undefined) return pageState.setRecords(index, 'Qty', qty, NODE.RETURNS)
    if (qty > 0) addReturn(code, qty)
  }

  // The routing answers are handed BACK IN: `restockNode` always writes all three
  // controls, so building without them resets a direct restock to "pending, no warehouse".
  function setRestockQty (code, qty) {
    if (!restocksAllowed) return
    const index = restockIndexBySku.value[code]
    if (index !== undefined) return pageState.setChildren(NODE.RESTOCK_ITEMS, index, 'Quantity', qty, NODE.RESTOCKS)
    if (qty <= 0) return
    const routing = restockRoutingOf(pageState)
    pageState.updateResource(NODE.RESTOCKS, null, restockNode({ OutletCode: outletCode.value }, [], routing))
    pageState.addChild(NODE.RESTOCK_ITEMS, restockItemRow({ SKU: code, Quantity: qty }, routing), NODE.RESTOCKS)
  }

  // The four live figures for ONE sku, plus the single number the officer actually moves.
  function fieldsFor (sku) {
    const code = text(sku)

    const soldBound = pageState.useChildren(NODE.ITEMS, () => indexBySku.value[code], 'Qty', NODE.CONSUMPTION, '$default')
    const returnBound = pageState.useRecords(() => returnIndexBySku.value[code], 'Qty', NODE.RETURNS)
    const restockBound = pageState.useChildren(NODE.RESTOCK_ITEMS, () => restockIndexBySku.value[code], 'Quantity', NODE.RESTOCKS)

    const system = computed(() => systemQtyOf(code))
    const sold = computed(() => Number(soldBound.value) || 0)
    const returned = computed(() => Number(returnBound.value) || 0)
    const restock = computed(() => Number(restockBound.value) || 0)

    // At or below the system figure the difference is a sale; above it, a surplus, which
    // is a return. The arithmetic is the domain's — see `useConsumptionStock`.
    const counted = computed({
      get: () => system.value - sold.value + returned.value,
      set: (value) => {
        const found = positive(value)
        setSoldQty(code, soldQty(system.value, found))
        setReturnQty(code, returnQty(system.value, found))
        setRestockQty(code, defaultRestockQty(system.value, found))
      }
    })

    return { system, sold, returned, restock, counted }
  }

  // Found on the shelf but not on it in the system: a return, never a consumption line.
  const addFoundItem = (sku, qty) => {
    const code = text(sku)
    const found = positive(qty)
    if (code && found > 0) addReturn(code, found)
  }

  return { outletCode, systemQtyOf, fieldsFor, addFoundItem }
}
