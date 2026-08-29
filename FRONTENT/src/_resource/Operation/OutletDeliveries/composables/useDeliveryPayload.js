/**
 * OutletDeliveries — the batch payloads a delivery run writes. Layer 2.
 *
 * A manifest bundles already-allocated `OutletRestockItems` lines, possibly across several
 * outlets and several parent requests, into one physical run. Executing that run touches
 * four resources at once, and the ORDER and the OWNERSHIP of those writes are the business
 * rule, so they live here rather than in the sticky bar that dispatches them (§3).
 *
 * ── WHAT THIS MODULE OWNS, AND WHAT IT BORROWS ──
 * It owns the MANIFEST: its state machine, its CSV line-up, and when a run counts as
 * departed or finished.
 *
 * It owns NONE of the following, and calls the restock domain for every one of them:
 *   - what happens to an `OutletRestockItems` row when it is delivered;
 *   - the positive `OutletMovements` row that arrival writes;
 *   - the parent `OutletRestocks` progress that results.
 *
 * All three are `buildRestockDeliveryNodes`, called once per affected parent request
 * (§9.1, §10.1). The restock progress formula in particular is NEVER replicated here — it
 * is `nextRestockProgress`, which the standalone `MarkDelivered` route also uses, so a line
 * delivered on a manifest and the same line delivered directly leave the parent in the same
 * state by construction.
 *
 * PURE functions throughout: no refs, no injects, no store or service call, nothing
 * rendered. Every builder takes plain rows and returns the canonical envelope
 * `{ valid, nodes, permissions, message, successMsg }` (§9.2), so a `PageAction.js`
 * running outside any setup context can call it. `resourceRequests` is imported rather than
 * `usePageState` for the same reason.
 *
 * ── ONE HONEST CAVEAT ABOUT THE IMPORT GRAPH ──
 * No function in this file reaches a store, but the MODULE GRAPH does, transitively and
 * not by this module's choice: `useRestockPayload` re-exports `useRestockCreation`, which
 * imports `useRestockStockMatch`, which reads `useWarehouseStorageResource` — and that is a
 * resource aggregate backed by `useDataStore`. So importing the restock delivery builder
 * pulls the data store into the graph.
 *
 * That is pre-existing, and it is the same shape the codebase already accepts elsewhere
 * (`useConsumptionStock.priceOf` reaches `usePriceListResource` the same way): a RESOURCE
 * AGGREGATE owning store-backed indexes is normal, even though a PAYLOAD BUILDER calling a
 * store is not. Nothing here calls one. It is written down rather than left implied,
 * because a reader checking §9.6 compliance by following imports will otherwise find a
 * store and reasonably conclude this file broke the rule.
 */

import { textOrRef } from 'src/utils/appHelpers'
import {
  buildRestockDeliveryNodes,
  nextRestockProgress
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import {
  DRAFT,
  IN_TRANSIT,
  COMPLETED,
  CANCELLED,
  ITEM_DELIVERED,
  isDraft,
  isInTransit,
  isCancelled,
  isCompleted,
  canCancel,
  canComplete,
  canDeliver,
  orsisForDelivery,
  deliveryRatio
} from './useDeliveryProgress'

import { stampFields } from 'src/utils/workflowStamp'
const RESOURCE_NAME = 'OutletDeliveries' // this module IS OutletDeliveries — always

const RESTOCKS = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const todayISO = () => new Date().toISOString().slice(0, 10)


/** The manifest's CSV, rebuilt from a code list. One writer, so the format cannot drift. */
function codesToCsv (codes) {
  return asList(codes).map(text).filter(Boolean).join(',')
}

/**
 * Index the item rows by code, in ONE pass.
 *
 * Every builder below needs to look lines up by code, often inside a loop over the
 * manifest's CSV. A `.find()` per code would be `O(n×m)` over the largest child sheet in the
 * system (ARCHITECTURE RULES §6).
 */
function indexByCode (rows) {
  const map = new Map()
  for (const raw of asList(rows)) {
    const row = asRow(raw)
    const code = text(row.Code)
    if (code) map.set(code, row)
  }
  return map
}

/**
 * Group the manifest's lines by the parent restock each belongs to.
 *
 * The manifest is flat — a list of item codes — but every downstream write is PER PARENT
 * REQUEST: one restock update, one movement set, one progress recomputation. This is where
 * the flat list becomes that grouping, built in one pass off the pre-built index.
 */
function groupByRestock (codes, itemsByCode) {
  const groups = new Map()
  for (const code of asList(codes).map(text).filter(Boolean)) {
    const row = itemsByCode.get(code)
    if (!row) continue
    const parentCode = text(row.OutletRestockCode)
    if (!parentCode) continue
    if (!groups.has(parentCode)) groups.set(parentCode, [])
    groups.get(parentCode).push(row)
  }
  return groups
}

/**
 * The parent-restock updates implied by a manifest change that delivers NOTHING.
 *
 * Removing lines from a run, or cancelling it, does not touch any `OutletRestockItems` row —
 * the lines stay ALLOCATED and become available for another van. But the parent request's
 * progress is still recomputed, because `nextRestockProgress` is the one function that
 * decides it and the parent may have been left in a stale state by an earlier partial
 * delivery.
 *
 * Called with an empty delivered-set, so it asks the restock domain the same question the
 * delivery path asks, with nothing newly delivered.
 */
function restockProgressRefreshNodes (restockCodes, allItemRows) {
  const byRestock = new Map()
  for (const raw of asList(allItemRows)) {
    const row = asRow(raw)
    const parentCode = text(row.OutletRestockCode)
    if (!parentCode) continue
    if (!byRestock.has(parentCode)) byRestock.set(parentCode, [])
    byRestock.get(parentCode).push(row)
  }

  // A role per request code: nodes are addressed by resource plus role, so roleless
  // updates for several restocks would collapse onto one address.
  return [...new Set(asList(restockCodes).map(text).filter(Boolean))]
    .map((code) => ({
      resource: RESTOCKS,
      role: code,
      code: textOrRef(code),
      record: {
        // The restock domain's own formula, over that request's FULL active child set.
        Progress: nextRestockProgress(byRestock.get(code) || [], [])
      },
      reload: [RESTOCKS]
    , permissions: { update: 'You are not allowed to update this outlet restock.' }, successMsg: allDelivered
      ? `Delivery ${code} completed — all ${ratio.total} items delivered.`
      : `${targetCodes.length} item${targetCodes.length === 1 ? '' : 's'} delivered. ${ratio.total - ratio.delivered} remaining.`}))
}

// ─── 1. Creating a manifest ───────────────────────────────────────────────────

/**
 * A new DRAFT manifest over the selected allocated lines.
 *
 * The lines themselves are NOT touched: they stay `ALLOCATED`, because bundling a line into
 * a run is a planning act, not a physical one. Nothing has left a warehouse that had not
 * already left it at approval time, and nothing has reached an outlet. That is also why a
 * manifest can be cancelled with no ledger consequences at all (see the cancel builder).
 */
export function buildDeliveryCreateNodes ({ date = '', userName = '', selectedOrsiCodes = [] } = {}) {
  const codes = asList(selectedOrsiCodes).map(text).filter(Boolean)
  if (!codes.length) {
    return [{ valid: false, message: 'Select at least one allocated item for this delivery.' }]
  }
  if (!text(userName)) {
    return [{ valid: false, message: 'A driver or delivery agent is required.' }]
  }

  const record = {
    Date: text(date) || todayISO(),
    UserName: text(userName),
    Progress: DRAFT,
    OutletRestockItemCodes: codesToCsv(codes),
    Status: 'Active'
  }

  return [
    { resource: RESOURCE_NAME, record: record, reload: [RESOURCE_NAME], successMsg: `Delivery draft created with ${codes.length} item${codes.length === 1 ? '' : 's'}.` }
  ]
}

// ─── 2. Departure ─────────────────────────────────────────────────────────────

/**
 * The run has left — DRAFT → IN_TRANSIT.
 *
 * A pure state stamp: no line changes, no ledger movement. It marks the moment the units
 * stopped being available to re-plan onto another van, which is why cancelling is no longer
 * offered afterwards.
 */
export function buildDeliveryMarkInTransitNodes ({ record = {}, actorName = '', comment = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return [{ valid: false, message: 'Delivery code is missing.' }]
  if (!isDraft(row)) {
    return [{ valid: false, message: 'Only a draft delivery can be marked as in transit.' }]
  }
  if (!orsisForDelivery(row).length) {
    return [{ valid: false, message: 'This delivery carries no items.' }]
  }

  return [
    { resource: RESOURCE_NAME, code: textOrRef(code), record: {
        Progress: IN_TRANSIT,
        ...stampFields('ProgressInTransit', actorName, comment || 'Delivery departed.')
      }, reload: [RESOURCE_NAME], successMsg: 'Delivery marked as in transit.' }
  ]
}

// ─── 3. Proof of delivery ─────────────────────────────────────────────────────

/**
 * ── THE CORE BUILDER — lines are handed over at the outlet. ──
 *
 * Everything that happens to a LINE is delegated, per parent request, to
 * `buildRestockDeliveryNodes`: the `OutletRestockItems` update, the positive
 * `OutletMovements` row, and the parent `OutletRestocks` progress. That builder is the one
 * the standalone restock `MarkDelivered` route uses too, so the two paths cannot write a
 * delivered line differently (§9.1).
 *
 * What this builder adds is the two things only a manifest knows:
 *
 *   1. `referenceCode` — the ledger row names THIS RUN, not the parent request, so a
 *      reconciliation can trace which van carried the units. That is the option added to the
 *      restock builder for this caller; the standalone route keeps its own default.
 *   2. the manifest's own next state — COMPLETED once every line on the CSV is delivered,
 *      IN_TRANSIT while any remain. Asked of the POST-delivery picture, never of the stored
 *      rows, which is why the item index is patched before the ratio is taken.
 *
 * A manifest spanning three outlets therefore produces three restock legs plus one manifest
 * update, all in one atomic batch.
 */
export function buildDeliveryMarkDeliveredNodes ({
  deliveryRecord = {},
  deliveredOrsiCodes = [],
  allOrsiRows = [],
  allRestockRows = [],
  actorName = '',
  comment = ''
} = {}) {
  const manifest = asRow(deliveryRecord)
  const code = text(manifest.Code)

  if (!code) return [{ valid: false, message: 'Delivery code is missing.' }]
  if (!canDeliver(manifest)) {
    return [{ valid: false, message: 'This delivery has come to rest and can no longer take deliveries.' }]
  }

  const manifestCodes = orsisForDelivery(manifest)
  const itemsByCode = indexByCode(allOrsiRows)
  const restocksByCode = indexByCode(allRestockRows)

  // Only lines this manifest actually carries, and only ones not already handed over.
  // A code the caller supplied that belongs to another run must not be delivered here.
  const manifestSet = new Set(manifestCodes)
  const targetCodes = asList(deliveredOrsiCodes).map(text).filter(Boolean)
    .filter((itemCode) => manifestSet.has(itemCode))
    .filter((itemCode) => text(itemsByCode.get(itemCode)?.Progress) !== ITEM_DELIVERED)

  if (!targetCodes.length) {
    return [{ valid: false, message: 'Select at least one undelivered item on this delivery.' }]
  }

  const note = text(comment) || `Delivered by ${text(actorName) || 'driver'}, ${code}`

  // One leg per parent request — the grouping the restock domain expects.
  const groups = groupByRestock(targetCodes, itemsByCode)
  if (!groups.size) {
    return [{ valid: false, message: 'The selected items could not be matched to a restock request.' }]
  }

  const nodes = []
  const missingParents = []

  for (const [restockCode, deliveredRows] of groups) {
    const parent = restocksByCode.get(restockCode)
    if (!parent) {
      missingParents.push(restockCode)
      continue
    }

    // That request's FULL active child set, so the restock domain can answer "is anything
    // still outstanding?" — a question about the rows NOT being delivered, which a builder
    // handed only the selection cannot answer.
    const allItemsForRestock = asList(allOrsiRows)
      .map(asRow)
      .filter((row) => text(row.OutletRestockCode) === restockCode)

    nodes.push(...buildRestockDeliveryNodes(parent, deliveredRows, actorName, note, {
      allItems: allItemsForRestock,
      // The ledger names the RUN that carried these units.
      referenceCode: code,
      // One role per parent request, so several requests on one run stay separate nodes.
      role: restockCode
    }))
  }

  if (missingParents.length) {
    return [{ valid: false, message: `Restock request ${missingParents[0]} could not be loaded, so its items cannot be delivered.` }]
  }

  // The manifest's own state, asked of the picture AFTER this batch lands. The index is
  // patched rather than the rows re-fetched, because the answer must reflect what this
  // batch is about to write, not what the store currently holds.
  const deliveredSet = new Set(targetCodes)
  const projectedRows = manifestCodes.map((itemCode) => {
    const row = itemsByCode.get(itemCode)
    if (!row) return { Code: itemCode, Progress: '' }
    return deliveredSet.has(itemCode) ? { ...row, Progress: ITEM_DELIVERED } : row
  })

  const ratio = deliveryRatio(manifest, projectedRows)
  const allDelivered = ratio.total > 0 && ratio.delivered === ratio.total
  const nextProgress = allDelivered ? COMPLETED : IN_TRANSIT

  nodes.push({ resource: RESOURCE_NAME, code: textOrRef(code), record: {
    Progress: nextProgress,
    ...(allDelivered
      ? stampFields('ProgressCompleted', actorName, `All ${ratio.total} items delivered.`)
      : stampFields('ProgressInTransit', actorName, `Delivered ${ratio.delivered} of ${ratio.total} items.`))
  }, reload: ['OutletStorages', RESTOCK_ITEMS, RESOURCE_NAME, RESTOCKS] })

  return nodes
}

// ─── 4. Editing the line-up ───────────────────────────────────────────────────

/**
 * Replace the manifest's CSV with a new set of lines.
 *
 * The one builder behind both the Edit page and the "remove items" case: adding and removing
 * are the same operation seen from two ends, and expressing them separately would be two
 * places that decide what a manifest's line-up is.
 *
 * ── WHAT IT REFUSES ──
 * A DELIVERED line cannot be dropped. Those units are physically on an outlet shelf and the
 * ledger says so; removing the line from the manifest would orphan a movement row that
 * points at this run, and the delivery ratio would then disagree with the outlet's stock.
 *
 * ── WHAT IT DOES NOT TOUCH ──
 * The lines themselves. A line added to a run stays ALLOCATED, and a line removed stays
 * ALLOCATED and becomes available for another van. Only the parent requests' progress is
 * recomputed, through the restock domain.
 */
export function buildDeliveryEditManifestNodes ({
  record = {},
  newOrsiCodes = [],
  allOrsiRows = [],
  actorName = ''
} = {}) {
  const manifest = asRow(record)
  const code = text(manifest.Code)

  if (!code) return [{ valid: false, message: 'Delivery code is missing.' }]
  if (isCancelled(manifest) || isCompleted(manifest)) {
    return [{ valid: false, message: 'This delivery has come to rest and its items can no longer be changed.' }]
  }

  const nextCodes = [...new Set(asList(newOrsiCodes).map(text).filter(Boolean))]
  if (!nextCodes.length) {
    return [{ valid: false, message: 'A delivery must carry at least one item. Cancel it instead.' }]
  }

  const itemsByCode = indexByCode(allOrsiRows)
  const previousCodes = orsisForDelivery(manifest)
  const nextSet = new Set(nextCodes)

  const droppedDelivered = previousCodes
    .filter((itemCode) => !nextSet.has(itemCode))
    .filter((itemCode) => text(itemsByCode.get(itemCode)?.Progress) === ITEM_DELIVERED)

  if (droppedDelivered.length) {
    return [{ valid: false, message: `${droppedDelivered.length} selected item${droppedDelivered.length === 1 ? ' has' : 's have'} already been delivered and cannot be removed from this delivery.` }]
  }

  // Every parent touched on either side of the change — a request that lost its last line
  // on this run needs recomputing just as much as one that gained a line.
  const affectedRestocks = new Set()
  for (const itemCode of [...previousCodes, ...nextCodes]) {
    const parentCode = text(itemsByCode.get(itemCode)?.OutletRestockCode)
    if (parentCode) affectedRestocks.add(parentCode)
  }

  // The manifest may already be finished by this edit — dropping the one undelivered line
  // from an otherwise-complete run leaves nothing outstanding.
  const projectedRows = nextCodes.map((itemCode) => itemsByCode.get(itemCode) || { Code: itemCode, Progress: '' })
  const ratio = deliveryRatio({ ...manifest, OutletRestockItemCodes: codesToCsv(nextCodes) }, projectedRows)
  const allDelivered = ratio.total > 0 && ratio.delivered === ratio.total

  const update = {
    OutletRestockItemCodes: codesToCsv(nextCodes),
    ...(allDelivered
      ? { Progress: COMPLETED, ...stampFields('ProgressCompleted', actorName, `All ${ratio.total} items delivered.`) }
      : {})
  }

  return [
    { resource: RESOURCE_NAME, code: textOrRef(code), record: update, reload: [RESOURCE_NAME, RESTOCK_ITEMS, RESTOCKS], successMsg: `Delivery updated — ${nextCodes.length} item${nextCodes.length === 1 ? '' : 's'}.` },
    ...restockProgressRefreshNodes([...affectedRestocks], allOrsiRows)
  ]
}

/**
 * Drop lines from the manifest without delivering them.
 *
 * A thin projection onto `buildDeliveryEditManifestNodes`: removing is editing to a smaller
 * set, and routing it through the one builder is what keeps the delivered-line protection
 * and the parent recomputation from having to be restated (§3.3).
 */
export function buildDeliveryRemoveItemsNodes ({
  deliveryRecord = {},
  orsiCodesToRemove = [],
  allOrsiRows = [],
  actorName = ''
} = {}) {
  const manifest = asRow(deliveryRecord)
  const removing = new Set(asList(orsiCodesToRemove).map(text).filter(Boolean))
  if (!removing.size) return [{ valid: false, message: 'Select at least one item to remove.' }]

  const remaining = orsisForDelivery(manifest).filter((code) => !removing.has(code))

  return buildDeliveryEditManifestNodes({
    record: manifest,
    newOrsiCodes: remaining,
    allOrsiRows,
    actorName
  })
}

// ─── 5. Closing a run ─────────────────────────────────────────────────────────

/**
 * Manually close an IN_TRANSIT manifest whose lines are all delivered.
 *
 * A SAFETY NET, not the normal path: `buildDeliveryMarkDeliveredNodes` closes a run itself
 * the moment its last line lands. This exists for the run that did not close — a line
 * delivered through the standalone restock route, or a batch that partially failed — and
 * would otherwise sit in the active queue forever.
 *
 * `canComplete` is validated here as well as in the UI, because the whole point of this
 * builder is to be reachable when the automatic path did not fire.
 */
export function buildDeliveryMarkCompleteNodes ({
  record = {},
  orsiRows = [],
  actorName = '',
  comment = ''
} = {}) {
  const manifest = asRow(record)
  const code = text(manifest.Code)

  if (!code) return [{ valid: false, message: 'Delivery code is missing.' }]
  if (!isInTransit(manifest)) {
    return [{ valid: false, message: 'Only a delivery in transit can be completed.' }]
  }
  if (!canComplete(manifest, orsiRows)) {
    const ratio = deliveryRatio(manifest, orsiRows)
    return [{ valid: false, message: `${ratio.total - ratio.delivered} item${ratio.total - ratio.delivered === 1 ? ' is' : 's are'} still undelivered on this delivery.` }]
  }

  return [
    { resource: RESOURCE_NAME, code: textOrRef(code), record: {
        Progress: COMPLETED,
        ...stampFields('ProgressCompleted', actorName, comment || 'Delivery confirmed complete.')
      }, reload: [RESOURCE_NAME], successMsg: `Delivery ${code} completed.` }
  ]
}

/**
 * Abandon the run.
 *
 * ── WHY NOTHING PHYSICAL IS REVERSED ──
 * Bundling a line into a manifest never moved anything: the units left the warehouse at
 * APPROVAL time, and they reach the outlet at DELIVERY time. A manifest cancelled before
 * either has no ledger consequence at all, which is precisely why cancelling is restricted
 * to a DRAFT with nothing delivered. Its lines stay `ALLOCATED` and are immediately
 * available to another run.
 *
 * The parent requests are still recomputed through the restock domain, because a request
 * whose lines were all on this run must not be left claiming a delivery is in progress.
 */
export function buildDeliveryCancelNodes ({
  record = {},
  orsiRows = [],
  actorName = '',
  reason = ''
} = {}) {
  const manifest = asRow(record)
  const code = text(manifest.Code)

  if (!code) return [{ valid: false, message: 'Delivery code is missing.' }]
  if (isCancelled(manifest)) return [{ valid: false, message: 'This delivery is already cancelled.' }]
  if (!text(reason)) return [{ valid: false, message: 'A cancellation reason is required.' }]

  if (!canCancel(manifest, orsiRows)) {
    // The two failures are genuinely different and the operator's next step differs, so
    // they are reported apart rather than as one "cannot cancel".
    if (!isDraft(manifest)) {
      return [{ valid: false, message: 'Only a draft delivery can be cancelled. Remove its remaining items instead.' }]
    }
    return [{ valid: false, message: 'Items on this delivery have already been handed over, so it can no longer be cancelled.' }]
  }

  const affectedRestocks = new Set()
  const itemsByCode = indexByCode(orsiRows)
  for (const itemCode of orsisForDelivery(manifest)) {
    const parentCode = text(itemsByCode.get(itemCode)?.OutletRestockCode)
    if (parentCode) affectedRestocks.add(parentCode)
  }

  return [
    { resource: RESOURCE_NAME, code: textOrRef(code), record: {
        Progress: CANCELLED,
        // Plain Cancelled* - this sheet does NOT prefix them with Progress.
        ...stampFields('Cancelled', actorName, reason)
      }, reload: [RESOURCE_NAME, RESTOCKS], successMsg: `Delivery ${code} cancelled. Its items are available for another run.` },
    ...restockProgressRefreshNodes([...affectedRestocks], orsiRows)
  ]
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useDeliveryPayload () {
  return {
    stampFields,
    buildDeliveryCreateNodes,
    buildDeliveryMarkInTransitNodes,
    buildDeliveryMarkDeliveredNodes,
    buildDeliveryEditManifestNodes,
    buildDeliveryRemoveItemsNodes,
    buildDeliveryMarkCompleteNodes,
    buildDeliveryCancelNodes
  }
}

export { stampFields }
