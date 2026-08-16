/**
 * OutletRestocks — CREATING a restock request. Layer 2, the domain payload chain.
 *
 * Every way a restock is raised comes through this file: the standalone Add wizard, and
 * the consumption wizard's step-4 replenishment. Both write the same columns, the same
 * `Progress` vocabulary, and the same warehouse deduction — because both call the same
 * builder, not because two files were kept in step (UI_RESOURCE_DOMAIN_LOGIC.md §9.1).
 *
 * Split out of `useRestockPayload.js` purely for file size (CORE_ARCHITECTURE_RULES §9,
 * ~400 lines); it is the same layer, the same purity rules, and every export is
 * re-exported from that file so a caller still has ONE import.
 *
 * ── THE THREE MODES ──
 *   DRAFT             parent DRAFT, lines PENDING. Nothing is committed; the requester
 *                     finishes it later from the Restocks module. No submission stamp — a
 *                     draft has not been submitted, and leaving the stamp empty is what
 *                     lets a later real submit record when it actually happened.
 *   PENDING_APPROVAL  parent PENDING_APPROVAL with its submission stamp, lines PENDING.
 *                     An approver allocates stock afterwards.
 *   DIRECT            parent APPROVED. Lines the chosen warehouse can actually cover
 *                     become ALLOCATED against it and deduct warehouse stock immediately
 *                     via `StockMovements`; anything short stays PENDING for a later
 *                     allocation. PARTIAL COVER IS A SUPPORTED OUTCOME, not a failure.
 *
 * PURE functions throughout: no refs, no injects, no stores, nothing rendered (§9.6).
 */

import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import {
  compositeSaveRequest,
  resourceBulkRequest,
  resourceGetRequest
} from 'src/composables/resources/resourceRequests'
import { splitByWarehouseStock } from './useRestockStockMatch'

// This composable IS OutletRestocks — always. Never route-derived (§3.2).
const RESOURCE_NAME = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const STOCK_MOVEMENTS = 'StockMovements'
const OUTLET_MOVEMENTS = 'OutletMovements'
const CONSUMPTIONS = 'OutletConsumptions'

const DEFAULT_STORAGE = '_default'
// A warehouse movement and an outlet movement written for the same restock describe two
// different legs of one journey; the ledgers must stay tellable apart when reconciling.
const REF_RESTOCK = 'OutletRestock'
const REF_RESTOCK_DELIVERY = 'RestockDelivery'

/** The batch path a request created in the same trip chains its parent code off. */
export const RESTOCK_REF_PATH = `${RESOURCE_NAME}.latest.code`

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

/**
 * One workflow stamp — the At/By/Comment triple for a `Progress<State>` prefix.
 *
 * `toDateTime24` rather than an ISO string: GAS stamps these same columns with
 * `formatDateTime24()` whenever an `executeAction` writes one, and two formats in one
 * column would sort and read inconsistently depending on which path wrote the row.
 *
 * Written under the hood, never exposed as form fields, so a submission cannot be
 * back-dated or attributed to someone else.
 */
function stampFields (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

/** The canonical mode name, whatever spelling the caller used. */
function modeOf (mode = '', draft = false) {
  const value = text(mode).toUpperCase()
  if (draft === true && value !== 'DIRECT') return 'DRAFT'
  if (value === 'DIRECT' || value === 'APPROVED') return 'DIRECT'
  if (value === 'DRAFT') return 'DRAFT'
  return 'PENDING_APPROVAL'
}

/** Lines worth writing: a SKU and a positive quantity. Everything else is not a request. */
function usableLines (lines = []) {
  return (Array.isArray(lines) ? lines : []).map(asRow)
    .filter((row) => text(row.SKU) && num(row.Quantity) > 0)
    .map((row) => ({ SKU: text(row.SKU), Quantity: num(row.Quantity) }))
}

// ─── 1. The column values each mode writes ────────────────────────────────────

/**
 * The header columns and the allocated-line patch a create lands with.
 *
 * Exported separately from the chain builder because the standalone Add wizard collects
 * its record through `pageState` — the page owns the form node, so Layer 3 applies these
 * values to it and then hands the assembled composite back as `baseRequests`. What the
 * columns ARE is still decided here; Layer 3 only carries them across (§9.1).
 */
export function restockCreateFields ({
  mode = 'PENDING_APPROVAL',
  draft = false,
  warehouseCode = '',
  actorName = '',
  comment = ''
} = {}) {
  const resolved = modeOf(mode, draft)
  const direct = resolved === 'DIRECT'

  return {
    mode: resolved,
    header: {
      Progress: direct ? 'APPROVED' : resolved,
      // A draft is not a submission, so it gets NO stamp: leaving the columns empty is
      // what lets a later real submit record when it actually happened. Every other mode
      // was submitted, and a direct one was submitted AND approved in the same act — two
      // stages of one timeline, so both are stamped rather than the approval overwriting
      // the submission it followed.
      ...(resolved === 'DRAFT' ? {} : stampFields('ProgressSubmitted', actorName, comment)),
      ...(direct
        ? {
            ApprovedUser: text(actorName),
            ...stampFields('ProgressApproved', actorName, 'Auto-approved as a direct restock from the source warehouse.')
          }
        : {}),
      Status: 'Active'
    },
    // Only a direct restock allocates now. A draft or an approval request is allocated
    // later, by someone looking at the warehouse at that time — pinning a warehouse now
    // would record an availability that has expired by the time it is acted on.
    linePatch: direct
      ? {
          WarehouseCode: text(warehouseCode),
          StorageName: DEFAULT_STORAGE,
          Progress: 'ALLOCATED',
          ...stampFields('ProgressAllocated', actorName, 'Allocated from the source warehouse on submission.')
        }
      : null
  }
}

/** Every resource a create in this mode writes — the single gate Layer 3 checks (§9.3). */
export function restockCreatePermissions ({ mode = 'PENDING_APPROVAL', draft = false } = {}) {
  const permissions = { [RESOURCE_NAME]: 'create', [RESTOCK_ITEMS]: 'create' }
  if (modeOf(mode, draft) === 'DIRECT') permissions[STOCK_MOVEMENTS] = 'create'
  return permissions
}

// ─── 2. The standalone create chain ───────────────────────────────────────────

/**
 * The full batch a standalone restock create submits.
 *
 * `baseRequests` is the composite save the page already assembled from its own form node
 * (`pageState.build()`), so a field the wizard collects — the date, the requesting user,
 * the submission comment — rides along without this builder having to restate the form
 * schema. Anything this batch adds is appended AFTER it, in dependency order, because the
 * movements below reference the restock code that composite is about to generate (§9.3.3).
 */
export function buildRestockCreateChainRequests ({
  outletCode = '',
  mode = 'PENDING_APPROVAL',
  draft = false,
  warehouseCode = '',
  lines = [],
  baseRequests = [],
  actorName = ''
} = {}) {
  const resolved = modeOf(mode, draft)
  const direct = resolved === 'DIRECT'
  const rows = usableLines(lines)

  if (!text(outletCode)) {
    return { valid: false, requests: [], permissions: {}, message: 'Select an outlet before submitting.' }
  }
  if (!rows.length) {
    return { valid: false, requests: [], permissions: {}, message: 'Add at least one item with a quantity greater than zero.' }
  }
  if (direct && !text(warehouseCode)) {
    return { valid: false, requests: [], permissions: {}, message: 'Select a source warehouse before submitting a direct restock.' }
  }

  const requests = [...(Array.isArray(baseRequests) ? baseRequests : [])]

  if (direct) {
    // NEGATIVE: the units are committed OUT of the warehouse. `Math.abs` first, so a row
    // carrying a negative quantity cannot flip the direction and credit the warehouse.
    requests.push(resourceBulkRequest(STOCK_MOVEMENTS, rows.map((row) => ({
      WarehouseCode: text(warehouseCode),
      StorageName: DEFAULT_STORAGE,
      SKU: row.SKU,
      QtyChange: -Math.abs(row.Quantity),
      ReferenceType: REF_RESTOCK,
      ReferenceCode: textOrRef(batchRef(RESTOCK_REF_PATH)),
      Status: 'Active'
    })), ['WarehouseStorages']))
    // The deduction just changed balances the next page derives from. Pull them back in
    // the same round trip rather than leaving that page to find them stale (§9.5).
    requests.push(resourceGetRequest(['WarehouseStorages']))
  }

  return {
    valid: true,
    requests,
    permissions: restockCreatePermissions({ mode: resolved }),
    successMsg: resolved === 'DRAFT' ? 'Restock request saved as draft.' : 'Restock request submitted.'
  }
}

// ─── 3. The chained create (raised by another resource's workflow) ────────────

/**
 * The restock request another module's workflow raises, in whichever mode it chose.
 *
 * Unlike the standalone create above, this one builds its own composite save: the caller
 * has no `pageState` node for a restock — it is submitting a consumption — so the header
 * and the item lines are assembled here from plain values.
 *
 * `markDelivered` additionally walks the allocated lines to DELIVERED and writes the
 * POSITIVE `OutletMovements` arrival. That is the mirror of the warehouse deduction:
 * approval takes the units off the warehouse shelf, delivery puts them on the outlet's.
 * Nothing here touches warehouse stock twice.
 *
 * ── STANDING ALONE ──
 * `linkToConsumption: false` writes a BLANK `OutletConsumptionCode`. A restock raised by a
 * visit that consumed nothing has no parent consumption to point at — the batch does not
 * create one — and leaving the default `$ref` in place would ask GAS to resolve a
 * reference to a record that was never written. The restock is a first-class request in
 * its own right; the link is a provenance note, not a dependency.
 */
export function buildRestockRequests (form = {}, restockRows = [], options = {}) {
  const entry = asRow(form)
  const rows = usableLines(restockRows)
  if (!rows.length) return { requests: [], allocated: [], pending: [], shortfall: 0 }

  const resolved = modeOf(options.mode)
  const direct = resolved === 'DIRECT'
  const warehouseCode = text(options.warehouseCode)
  const actorName = text(options.actorName)
  const date = text(entry.Date) || todayISO()
  const markDelivered = direct && options.markDelivered === true
  // Explicit opt-OUT rather than a falsy check: `''` is exactly what a caller with no
  // consumption would pass, and `|| batchRef(…)` would silently turn that into the $ref it
  // was trying to suppress.
  const standalone = options.linkToConsumption === false
  const consumptionCode = standalone
    ? ''
    : textOrRef(options.consumptionRef || batchRef(`${CONSUMPTIONS}.latest.code`))
  // The workflow timeline shows this verbatim, so it has to be true of the record it is
  // written on: a standalone restock has no consumption to have been submitted "with".
  const origin = standalone
    ? 'Submitted from an outlet visit that recorded no consumption.'
    : 'Submitted with an outlet consumption.'

  const split = direct
    ? splitByWarehouseStock(rows, warehouseCode, options.warehouseStorages || [])
    : { allocated: [], pending: rows, shortfall: 0 }

  const itemProgress = markDelivered ? 'DELIVERED' : 'ALLOCATED'
  const children = [
    ...split.allocated.map((row) => ({
      _action: 'create',
      data: {
        SKU: row.SKU,
        Quantity: row.Quantity,
        WarehouseCode: warehouseCode,
        StorageName: DEFAULT_STORAGE,
        Progress: itemProgress,
        ...stampFields('ProgressAllocated', actorName, 'Allocated from the source warehouse during consumption submission.'),
        ...(markDelivered ? stampFields('ProgressDelivered', actorName, 'Delivered to the outlet during consumption submission.') : {}),
        Status: 'Active'
      }
    })),
    ...split.pending.map((row) => ({
      _action: 'create',
      data: {
        SKU: row.SKU,
        Quantity: row.Quantity,
        WarehouseCode: '',
        StorageName: '',
        Progress: 'PENDING',
        Status: 'Active'
      }
    }))
  ]

  // A direct restock whose lines were ALL delivered is finished; one carrying a shortfall
  // is not, and says so rather than claiming completion. Derived from the pending lines
  // themselves, so the parent state cannot disagree with its children.
  const parentProgress = direct
    ? (markDelivered ? (split.pending.length ? 'PARTIALLY_DELIVERED' : 'DELIVERED') : 'APPROVED')
    : resolved

  const requests = [compositeSaveRequest({
    resource: RESOURCE_NAME,
    data: {
      Date: date,
      OutletCode: text(entry.OutletCode),
      OutletConsumptionCode: consumptionCode,
      RequestedUser: text(entry.Username),
      ApprovedUser: direct ? actorName : '',
      Progress: parentProgress,
      ...(resolved === 'PENDING_APPROVAL' ? stampFields('ProgressSubmitted', actorName, origin) : {}),
      ...(direct ? stampFields('ProgressApproved', actorName, 'Auto-approved as a direct restock from the source warehouse.') : {}),
      ...(markDelivered ? stampFields('ProgressDelivered', actorName, 'Delivered to the outlet during consumption submission.') : {}),
      Status: 'Active'
    },
    children: [{ resource: RESTOCK_ITEMS, records: children }]
  })]

  if (direct && split.allocated.length) {
    // NEGATIVE: the units are committed OUT of the warehouse.
    requests.push(resourceBulkRequest(STOCK_MOVEMENTS, split.allocated.map((row) => ({
      WarehouseCode: warehouseCode,
      StorageName: DEFAULT_STORAGE,
      SKU: row.SKU,
      QtyChange: -Math.abs(row.Quantity),
      ReferenceType: REF_RESTOCK,
      ReferenceCode: textOrRef(batchRef(RESTOCK_REF_PATH)),
      Status: 'Active'
    })), ['WarehouseStorages']))

    if (markDelivered) {
      // POSITIVE, on the OUTLET ledger — the other leg. Written only when the user
      // confirmed the stock physically travelled with them.
      requests.push(resourceBulkRequest(OUTLET_MOVEMENTS, split.allocated.map((row) => ({
        OutletCode: text(entry.OutletCode),
        StorageName: DEFAULT_STORAGE,
        SKU: row.SKU,
        QtyChange: Math.abs(row.Quantity),
        ReferenceType: REF_RESTOCK_DELIVERY,
        ReferenceCode: textOrRef(batchRef(RESTOCK_REF_PATH)),
        MovementDate: date,
        Status: 'Active'
      })), ['OutletStorages']))
    }
  }

  return { requests, allocated: split.allocated, pending: split.pending, shortfall: split.shortfall }
}

/**
 * The chained create as an envelope (§9.2) — what a sibling domain chain calls.
 *
 * Empty lines yield a VALID, EMPTY envelope rather than a failure: a consumption with no
 * replenishment is a normal submission, and the parent chain calls this unconditionally.
 */
export function buildRestockChainRequests ({
  form = {},
  lines = [],
  mode = 'PENDING_APPROVAL',
  warehouseCode = '',
  warehouseStorages = [],
  markDelivered = false,
  linkToConsumption = true,
  actorName = ''
} = {}) {
  const rows = usableLines(lines)
  if (!rows.length) return { valid: true, requests: [], permissions: {} }

  const resolved = modeOf(mode)
  if (resolved === 'DIRECT' && !text(warehouseCode)) {
    return { valid: false, requests: [], permissions: {}, message: 'Select a source warehouse for the direct restock.' }
  }

  const built = buildRestockRequests(form, rows, {
    mode: resolved,
    warehouseCode,
    warehouseStorages,
    markDelivered,
    linkToConsumption,
    actorName
  })

  const permissions = restockCreatePermissions({ mode: resolved })
  // Delivering on the visit puts the units on the outlet's shelf — the other leg, and a
  // second ledger this submission would otherwise write ungated.
  if (resolved === 'DIRECT' && markDelivered === true) permissions[OUTLET_MOVEMENTS] = 'create'

  return {
    valid: true,
    requests: built.requests,
    permissions,
    allocated: built.allocated,
    pending: built.pending,
    shortfall: built.shortfall,
    successMsg: 'Restock request created.'
  }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useRestockCreation () {
  return {
    RESTOCK_REF_PATH,
    restockCreateFields,
    restockCreatePermissions,
    buildRestockCreateChainRequests,
    buildRestockRequests,
    buildRestockChainRequests
  }
}
