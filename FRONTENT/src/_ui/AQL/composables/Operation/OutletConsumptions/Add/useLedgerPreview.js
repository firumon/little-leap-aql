import { useDataStore } from 'src/stores/data'
import { NODE, RESTOCKING } from './nodes'
import { countRowsOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { buildConsumptionMovementsNode } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
import { buildRestockMovementNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockCreation'
import { RESTOCK_CONTROL } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { OUTLET_ROLE } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'

// The two ledgers, kept in pageState as the wizard is answered rather than only at submit.
// Same Layer 2 builders the submit uses, so what the officer can inspect mid-wizard is
// exactly what the batch will carry. Registered through `derive` (UI_PAGE_STATE §12.3),
// never from a step card — a card's watch dies the moment the user leaves the step.

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

export function syncLedgerNodes (pageState) {
  const dataStore = useDataStore()
  const form = pageState.getRecord(null, NODE.CONSUMPTION) || {}
  const outletCode = text(form.OutletCode)

  const apply = (resource, role, node) => {
    if (node) pageState.applyNodes([node])
    else pageState.removeNode(resource, role)
  }

  // 1. The sale leg — what left the shelf. The node names its own role.
  const sold = pageState.getChildRows(NODE.ITEMS, NODE.CONSUMPTION).filter((row) => num(row.Qty) > 0)
  const returned = pageState.getRecordRows(NODE.RETURNS).filter((row) => num(row.Qty) > 0)
  const countRows = countRowsOf(sold, returned, dataStore.getRecords('OutletStorages') || [], outletCode)
  apply(NODE.OUTLET_MOVEMENTS, OUTLET_ROLE.SALE,
    outletCode ? buildConsumptionMovementsNode(form, countRows) : null)

  // 2. The restock legs — the warehouse issue and, when it travelled today, the delivery.
  const items = pageState.getChildRows(NODE.RESTOCK_ITEMS, NODE.RESTOCKS)
    .filter((row) => num(row.Quantity) > 0)
  const restocking = pageState.hasNode(NODE.RESTOCKS) &&
    pageState.getControls(RESTOCKING, true) === true

  const movements = restocking && outletCode && items.length
    ? buildRestockMovementNodes({
      outletCode,
      warehouseCode: text(pageState.getControls(RESTOCK_CONTROL.WAREHOUSE, '', NODE.RESTOCKS)),
      date: text(form.Date),
      items,
      direct: pageState.getControls(RESTOCK_CONTROL.DIRECT, false, NODE.RESTOCKS) === true,
      deliver: pageState.getControls(RESTOCK_CONTROL.DELIVER, false, NODE.RESTOCKS) === true
    })
    : []

  apply(NODE.STOCK_MOVEMENTS, null,
    movements.find((node) => node.resource === NODE.STOCK_MOVEMENTS) || null)
  apply(NODE.OUTLET_MOVEMENTS, OUTLET_ROLE.DELIVERY,
    movements.find((node) => node.resource === NODE.OUTLET_MOVEMENTS) || null)
}

// What the ledgers depend on: the counted sale, the restock lines, and the three routing
// answers. Declared once, with page lifetime, so no step card owns them.
export function ledgerDerive () {
  const handler = (value, pageState) => syncLedgerNodes(pageState)
  return [
    { on: { resource: NODE.CONSUMPTION, children: NODE.ITEMS }, handler },
    { on: { resource: NODE.RETURNS, records: true }, handler },
    { on: { resource: NODE.RESTOCKS, children: NODE.RESTOCK_ITEMS }, handler },
    { on: { resource: NODE.RESTOCKS, control: RESTOCK_CONTROL.DIRECT }, handler },
    { on: { resource: NODE.RESTOCKS, control: RESTOCK_CONTROL.DELIVER }, handler },
    { on: { resource: NODE.RESTOCKS, control: RESTOCK_CONTROL.WAREHOUSE }, handler },
    { on: { control: RESTOCKING }, handler }
  ]
}
