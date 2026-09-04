import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { resourceRow, useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { stampFields } from 'src/utils/workflowStamp'
import { splitByWarehouseStock } from './useRestockStockMatch'
import { STOCK_REFERENCE, stockMovementsNode } from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
import { OUTLET_REFERENCE, OUTLET_ROLE, outletMovementsNode } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'

const RESOURCE_NAME = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const CONSUMPTIONS = 'OutletConsumptions'
const DEFAULT_STORAGE = '_default'

export const RESTOCK_REF_PATH = `${RESOURCE_NAME}.latest.code`
export const RESTOCK_CONTROL = { DIRECT: 'direct', DELIVER: 'deliver', WAREHOUSE: 'WarehouseCode' }

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const todayISO = () => new Date().toISOString().slice(0, 10)
const actor = () => useAuth().user.value?.name || ''

// Always writes every stamp column, blank when the step did not happen: turning a toggle
// back OFF has to erase the stamp it wrote, or the row claims a step it never took.
//
// A stamp that is already there STANDS. The node is re-derived on every quantity change,
// and re-stamping would walk the clock forward on each keystroke and re-date a decision
// the user made minutes ago. Only a missing stamp is written.
const stamp = (on, prefix, actorName, comment, existing = null) => {
  if (!on) return { [`${prefix}At`]: '', [`${prefix}By`]: '', [`${prefix}Comment`]: '' }
  const had = asRow(existing)
  if (!text(had[`${prefix}At`])) return stampFields(prefix, actorName, comment)
  return {
    [`${prefix}At`]: text(had[`${prefix}At`]),
    [`${prefix}By`]: text(had[`${prefix}By`]) || text(actorName),
    [`${prefix}Comment`]: text(had[`${prefix}Comment`]) || text(comment)
  }
}

const usableLines = (lines = []) => (Array.isArray(lines) ? lines : []).map(asRow)
  .filter((row) => text(row.SKU) && num(row.Quantity) > 0)

// The routing answers, read from wherever the caller keeps them.
export function restockFlags (source = {}) {
  const seed = asRow(source)
  const mode = text(seed.mode || seed.RestockMode).toUpperCase()
  const direct = seed[RESTOCK_CONTROL.DIRECT] === true || mode === 'DIRECT' || mode === 'APPROVED'
  return {
    direct,
    // A direct restock allocates now, so it is never a draft.
    draft: !direct && (seed.draft === true || seed.isDraft === true || mode === 'DRAFT'),
    deliver: direct && seed[RESTOCK_CONTROL.DELIVER] === true,
    warehouseCode: direct ? text(seed[RESTOCK_CONTROL.WAREHOUSE] || seed.warehouseCode) : ''
  }
}

// A line is ALLOCATED once a warehouse is pinned to it, DELIVERED once it travelled.
export function restockItemProgress ({ direct = false, deliver = false } = {}) {
  if (deliver === true) return 'DELIVERED'
  if (direct === true) return 'ALLOCATED'
  return 'PENDING'
}

// A blank parent Progress means nobody chose one, so the lines decide it. A parent that
// arrives WITH a progress keeps it - that is an explicit decision, not a gap to fill.
export function deriveParentRestockProgress (parent = {}, children = []) {
  const given = text(asRow(parent).Progress)
  if (given) return given

  const rows = (Array.isArray(children) ? children : []).map(asRow)
  if (!rows.length) return 'PENDING_APPROVAL'

  const progress = rows.map((row) => text(row.Progress).toUpperCase())
  const delivered = progress.filter((one) => one === 'DELIVERED').length
  const allocated = progress.filter((one) => one === 'ALLOCATED').length

  if (delivered === progress.length) return 'DELIVERED'
  if (delivered > 0) return 'PARTIALLY_DELIVERED'
  if (allocated === progress.length) return 'APPROVED'
  return 'PENDING_APPROVAL'
}

// The one place a line's routing columns are decided. Only a row the stock split MARKED
// uncovered refuses a warehouse — never a row that merely still says PENDING, which is
// every line's default and would make the direct toggle unable to allocate anything.
function restockItemFields (flags = {}, child = {}, actorName = '') {
  const uncovered = asRow(child).Uncovered === true
  const direct = flags.direct === true && !uncovered
  const deliver = flags.deliver === true && !uncovered
  return {
    WarehouseCode: direct ? text(flags.warehouseCode) : '',
    StorageName: direct ? DEFAULT_STORAGE : '',
    Progress: restockItemProgress({ direct, deliver }),
    ...stamp(direct, 'ProgressAllocated', actorName, 'Allocated from the source warehouse.', child),
    ...stamp(deliver, 'ProgressDelivered', actorName, 'Carried to the outlet on this visit.', child),
    Status: 'Active'
  }
}

// ROW builder: one OutletRestockItems sheet row. `extra` may carry the routing answers —
// they are working state, so resourceRow drops them and only their effect survives.
export function restockItemRow (child = {}, extra = {}) {
  return resourceRow(RESTOCK_ITEMS, child, extra,
    restockItemFields(restockFlags(extra), child, actor()))
}

// The one place a restock header's routing columns are decided.
//
// `parent` is what DECIDES the progress (a blank one lets the lines decide); `existing` is
// what already HOLDS the stamps. They are separate because a re-derive has to recompute
// the progress from scratch while leaving stamps that were already written alone.
function restockParentFields (flags = {}, parent = {}, rows = [], actorName = '', origin = '', existing = null) {
  const direct = flags.direct === true
  const deliver = flags.deliver === true
  const draft = flags.draft === true
  const had = existing === null ? parent : existing
  return {
    Progress: draft ? 'DRAFT' : deriveParentRestockProgress(parent, rows),
    ApprovedUser: direct ? text(actorName) : '',
    // A draft was not submitted, so its stamp is ERASED, not merely left unwritten: the
    // routing derive may already have stamped it while the user was still deciding, and a
    // blank is what lets a later real submit record when it actually happened.
    ...stamp(!draft, 'ProgressSubmitted', actorName, origin, had),
    ...stamp(direct, 'ProgressApproved', actorName, 'Auto-approved as a direct restock from the source warehouse.', had),
    ...stamp(deliver, 'ProgressDelivered', actorName, 'Carried to the outlet on this visit.', had)
  }
}

/**
 * The note a submission carries when the user has not written one.
 *
 * Exported so the Add wizard can SEED it into the record and let the user amend it —
 * a default the user never sees is a value invented at submit.
 */
export function defaultSubmissionComment (withConsumption = true) {
  return withConsumption ? 'Submitted with an outlet consumption.' : 'Submitted from an outlet visit.'
}

/**
 * Whether this user may route a restock themselves, and out of which warehouse.
 *
 * The two questions a routing screen asks — "is there stock I may draw from?" and "am I
 * allowed to draw it?" — are one domain answer, not two UI conditions. A warehouse the
 * user's region does not reach is not a source, and a user who cannot approve cannot
 * self-approve either, so both live here rather than being re-tested per screen.
 *
 * `hasRegionAccess` also honours universe-scoped users and rolled-up child regions, which
 * a flat `=== accessRegion` test silently excludes.
 *
 * Plain function, not a computed: called from inside a caller's own `computed` or `watch`
 * it stays reactive, and called from a page contract's `ready` it still answers.
 */
export function restockDirectOptions () {
  const { hasRegionAccess } = useAuth()
  const config = useResourceConfig(RESOURCE_NAME)

  const warehouses = (useDataStore().getRecords('Warehouses') || [])
    .map(asRow)
    .filter((row) => text(row.Status || 'Active') === 'Active')
    .filter((row) => hasRegionAccess(row.AccessRegion))
    .map((row) => ({
      value: text(row.Code),
      label: [text(row.Code), text(row.Name)].filter(Boolean).join(' · ')
    }))
    .filter((option) => option.value)

  return {
    warehouses,
    canDirect: warehouses.length > 0 && config.allowed({ [RESOURCE_NAME]: 'Approve' }) === true,
    canDeliver: config.allowed({ [RESOURCE_NAME]: 'MarkDelivered' }) === true
  }
}

// NODE builder: a restock and its lines. `extra` carries the routing answers; the derive
// rules keep both levels in step when the officer changes one later.
export function restockNode (parent = {}, children = [], extra = {}, options = {}) {
  const actorName = actor()
  const flags = restockFlags(extra)
  const rows = (Array.isArray(children) ? children : []).map((child) => restockItemRow(child, extra))
  const origin = text(extra.origin) || defaultSubmissionComment(extra.linkToConsumption !== false)

  const record = resourceRow(RESOURCE_NAME, {
    RequestedUser: actorName,
    Date: todayISO(),
    Status: 'Active'
  }, parent, extra, restockParentFields(flags, parent, rows, actorName, origin))

  return {
    resource: RESOURCE_NAME,
    record,
    // No bucket when there are no lines, so a merge can set the header without wiping
    // lines that are already there.
    children: rows.length ? [{ resource: RESTOCK_ITEMS, records: rows }] : [],
    // The node carries its own working answers, so a screen never has to invent them.
    // They mirror the flags the record was built from and can never drift from it.
    controls: [
      { header: RESTOCK_CONTROL.DIRECT, value: flags.direct },
      { header: RESTOCK_CONTROL.DELIVER, value: flags.deliver },
      { header: RESTOCK_CONTROL.WAREHOUSE, value: text(flags.warehouseCode) }
    ],
    permissions: {
      create: 'You are not allowed to create a restock request.',
      ...(flags.direct ? { approve: 'You are not allowed to approve a direct restock.' } : {})
    },
    reload: [RESOURCE_NAME, RESTOCK_ITEMS],
    ...(options.withDerive === false ? {} : { derive: restockProgressDerive() })
  }
}

// The restock a VISIT raises, seeded from the consumption and what it sold. The one place
// that says a restock refills what the outlet just sold, and that a user with no warehouse
// to draw from cannot carry it directly.
export function restockNodeForConsumption (consumption = {}, soldRows = [], { warehouseCodes = [], warehouseCode = '' } = {}) {
  const entry = asRow(consumption)
  const lines = (Array.isArray(soldRows) ? soldRows : []).map(asRow)
    .map((row) => ({ SKU: text(row.SKU), Quantity: num(row.Qty ?? row.Quantity) }))
    .filter((row) => row.SKU && row.Quantity > 0)
  const houses = (Array.isArray(warehouseCodes) ? warehouseCodes : []).map(text).filter(Boolean)
  const direct = houses.length > 0
  return restockNode({ OutletCode: text(entry.OutletCode) }, lines, {
    [RESTOCK_CONTROL.DIRECT]: direct,
    [RESTOCK_CONTROL.DELIVER]: direct,
    [RESTOCK_CONTROL.WAREHOUSE]: direct ? (text(warehouseCode) || houses[0]) : ''
  })
}

// The routing answers as they stand on the node. Every screen that rebuilds the node has
// to hand these back in - `restockNode` always writes all three, so a build without them
// silently resets the routing to "pending, no warehouse".
export function restockRoutingOf (pageState) {
  return {
    [RESTOCK_CONTROL.DIRECT]: pageState?.getControls(RESTOCK_CONTROL.DIRECT, false, RESOURCE_NAME) === true,
    [RESTOCK_CONTROL.DELIVER]: pageState?.getControls(RESTOCK_CONTROL.DELIVER, false, RESOURCE_NAME) === true,
    [RESTOCK_CONTROL.WAREHOUSE]: text(pageState?.getControls(RESTOCK_CONTROL.WAREHOUSE, '', RESOURCE_NAME))
  }
}

// Re-reads the routing controls and rewrites the progress they decide, on the parent and
// on every line. Only what MOVED is written, so a re-run costs nothing and cannot loop.
export function syncRestockProgressInPageState (pageState) {
  if (!pageState?.hasNode?.(RESOURCE_NAME)) return
  const actorName = actor()
  const flags = restockFlags(restockRoutingOf(pageState))
  const record = asRow(pageState.getRecord?.(null, RESOURCE_NAME))

  const rows = pageState.getChildRows(RESTOCK_ITEMS, RESOURCE_NAME)
  const nextRows = rows.map((row) => restockItemFields(flags, row, actorName))

  // `{}` as the parent so the progress is recomputed from the lines; the live record as
  // `existing` so the stamps and the note the user is writing survive the recompute.
  pageState.setRecord(null,
    restockParentFields(flags, {}, nextRows, actorName,
      text(record.ProgressSubmittedComment), record),
    RESOURCE_NAME)

  rows.forEach((row, index) => {
    const fields = nextRows[index]
    const moved = Object.keys(fields).filter((key) => row[key] !== fields[key])
    if (moved.length) {
      pageState.setChildren(RESTOCK_ITEMS, index, null,
        Object.fromEntries(moved.map((key) => [key, fields[key]])), RESOURCE_NAME)
    }
  })
}

// The addresses the two ledger legs occupy, so a leg that stops applying can be dropped.
const LEDGER_ADDRESSES = [
  ['StockMovements', ''],
  ['OutletMovements', OUTLET_ROLE.DELIVERY]
]

/**
 * Rebuilds both ledgers from the lines as they stand.
 *
 * The ledgers are LIVE, not a submit-time afterthought: a screen watching the nodes has to
 * see the warehouse leg move the moment a quantity does. Each leg is addressed by resource
 * (plus role), so re-applying REPLACES its rows instead of stacking a second set, and a leg
 * the routing no longer calls for is removed rather than left holding stale rows.
 */
export function syncRestockLedgersInPageState (pageState) {
  if (!pageState?.hasNode?.(RESOURCE_NAME)) return
  const flags = restockFlags(restockRoutingOf(pageState))
  const record = asRow(pageState.getRecord?.(null, RESOURCE_NAME))

  const nodes = buildRestockMovementNodes({
    outletCode: text(record.OutletCode),
    warehouseCode: flags.warehouseCode,
    date: text(record.Date) || todayISO(),
    items: pageState.getChildRows(RESTOCK_ITEMS, RESOURCE_NAME),
    direct: flags.direct,
    deliver: flags.deliver
  })

  const wanted = new Set(nodes.map((node) => `${node.resource}|${text(node.role)}`))
  LEDGER_ADDRESSES.forEach(([name, role]) => {
    if (!wanted.has(`${name}|${role}`)) pageState.removeNode?.(name, role || undefined)
  })
  if (nodes.length) pageState.applyNodes(nodes)
}

// The whole incremental re-derive: progress first, because the ledgers read it off the
// lines. This is what every user action runs - a toggle, a quantity, a step move.
export function syncRestockInPageState (pageState) {
  syncRestockProgressInPageState(pageState)
  syncRestockLedgersInPageState(pageState)
}

/**
 * The LAST MILE of a submission, for a page whose node is already live.
 *
 * The Add wizard has been maintaining the whole restock in pageState since `ready` - the
 * header, the lines, the routing controls and both ledger legs, all re-derived on every
 * edit. Rebuilding that from scratch at submit would compute a second answer to a question
 * already answered, and any drift between the two would be invisible until it reached the
 * sheet. So this returns a MERGE node carrying only what submit itself decides.
 *
 * That is exactly two things, and neither can be known before the button is pressed:
 * whether this is a draft, and the note the user finally typed. Everything else is read
 * back off the live node. Ledgers are not returned at all - they are already standing.
 *
 * Use `buildRestockChainNodes` instead when there is no live node to finish, which is the
 * consumption chain's case: it raises a restock from nothing alongside other resources.
 */
export function restockSubmissionNodes (pageState, { draft = false, comment = '' } = {}) {
  if (!pageState?.hasNode?.(RESOURCE_NAME)) return [{ valid: false, message: 'Nothing to submit.' }]

  const record = asRow(pageState.getRecord?.(null, RESOURCE_NAME))
  const rows = usableLines(pageState.getChildRows(RESTOCK_ITEMS, RESOURCE_NAME))
  const flags = restockFlags({ ...restockRoutingOf(pageState), draft })

  if (!text(record.OutletCode)) return [{ valid: false, message: 'Select an outlet before submitting.' }]
  if (flags.direct && !text(flags.warehouseCode)) {
    return [{ valid: false, message: 'Select a source warehouse before submitting a direct restock.' }]
  }
  if (!rows.length) return [{ valid: false, message: 'Add at least one item with a quantity greater than zero.' }]

  const actorName = actor()
  const origin = text(comment) || text(record.ProgressSubmittedComment) || defaultSubmissionComment(false)

  return [{
    resource: RESOURCE_NAME,
    // Merge, never replace: the lines and the controls on this node are the user's work.
    merge: true,
    record: restockParentFields(flags, {}, rows, actorName, origin, record),
    permissions: {
      create: 'You are not allowed to create a restock request.',
      ...(flags.direct ? { approve: 'You are not allowed to approve a direct restock.' } : {})
    },
    reload: [RESOURCE_NAME, RESTOCK_ITEMS],
    successMsg: flags.draft ? 'Restock request saved as draft.' : 'Restock request submitted.'
  }]
}

// What the composed restock depends on: the three routing answers, and the lines
// themselves. The lines are in the list because the ledgers are built from their
// quantities - without that rule a `+` click would move the restock and leave the two
// stock legs behind, and the batch would only agree with itself at submit.
//
// Re-entrancy is safe: the handler writes only columns that actually MOVED, and none of
// them depend on Quantity, so a quantity change settles in one pass with no second write.
export function restockProgressDerive () {
  const handler = (value, pageState) => syncRestockInPageState(pageState)
  return [
    { on: { resource: RESOURCE_NAME, control: RESTOCK_CONTROL.DIRECT }, handler },
    { on: { resource: RESOURCE_NAME, control: RESTOCK_CONTROL.DELIVER }, handler },
    { on: { resource: RESOURCE_NAME, control: RESTOCK_CONTROL.WAREHOUSE }, handler },
    { on: { resource: RESOURCE_NAME, children: RESTOCK_ITEMS }, handler }
  ]
}

// The only place restock movements are made. Both ledgers are delegated to their owning
// module, so the sign rule and the row shape live there and not here.
export function buildRestockMovementNodes ({
  outletCode = '',
  warehouseCode = '',
  date = '',
  items = [],
  direct = false,
  deliver = false,
  restockRef = null
} = {}) {
  const reference = restockRef || batchRef(RESTOCK_REF_PATH)
  const rows = usableLines(items)

  const moved = direct === true
    ? rows.filter((row) => ['ALLOCATED', 'DELIVERED'].includes(text(row.Progress).toUpperCase()))
    : []
  const shipped = deliver === true
    ? rows.filter((row) => text(row.Progress).toUpperCase() === 'DELIVERED')
    : []

  const stock = stockMovementsNode(moved, {
    warehouseCode,
    referenceType: STOCK_REFERENCE.RESTOCK,
    referenceCode: reference,
    movementDate: date
  })

  const outlet = outletMovementsNode(shipped, {
    outletCode,
    // The delivery leg — the consumption's own sale leg writes the same resource.
    role: OUTLET_ROLE.DELIVERY,
    referenceType: OUTLET_REFERENCE.RESTOCK_DELIVERY,
    referenceCode: reference,
    movementDate: date
  })

  return [stock, outlet].filter(Boolean)
}

// The whole restock submission — header, lines and both ledgers, as a flat node list.
export function buildRestockChainNodes ({
  form = {},
  lines = [],
  mode = 'PENDING_APPROVAL',
  draft = false,
  warehouseCode = '',
  warehouseStorages = [],
  markDelivered = false,
  linkToConsumption = true,
  consumptionRef = null,
  comment = '',
  actorName = ''
} = {}) {
  const entry = asRow(form)
  const rows = usableLines(lines).map((row) => ({ SKU: text(row.SKU), Quantity: num(row.Quantity) }))
  // A consumption with no replenishment is a normal submission, so no lines means no nodes.
  if (!rows.length) return []

  const flags = restockFlags({
    mode,
    draft,
    [RESTOCK_CONTROL.DELIVER]: markDelivered,
    [RESTOCK_CONTROL.WAREHOUSE]: warehouseCode
  })
  const outletCode = text(entry.OutletCode)
  if (!outletCode) return [{ valid: false, message: 'Select an outlet before submitting.' }]
  if (flags.direct && !text(flags.warehouseCode)) {
    return [{ valid: false, message: 'Select a source warehouse before submitting a direct restock.' }]
  }

  // Only a direct restock allocates now, and only as far as the shelf covers. What is
  // left uncovered stays PENDING and keeps no warehouse. With no stock index to read,
  // the caller is not tracking cover, so every line allocates.
  let splitRows = rows
  const storages = Array.isArray(warehouseStorages) ? warehouseStorages : []
  if (flags.direct && storages.length) {
    const split = splitByWarehouseStock(rows, flags.warehouseCode, storages)
    splitRows = [
      ...split.allocated.map((row) => ({ ...row, Progress: flags.deliver ? 'DELIVERED' : 'ALLOCATED' })),
      // Marked, not just left PENDING: the field builder has to tell a line the warehouse
      // cannot cover apart from a line nobody has routed yet.
      ...split.pending.map((row) => ({ ...row, Progress: 'PENDING', Uncovered: true }))
    ]
  }

  // The ledgers read Progress off the line, so it is settled here, once, before both the
  // node and the movements are built from the same rows.
  splitRows = splitRows.map((row) => ({ ...row, Progress: text(row.Progress) || restockItemProgress(flags) }))

  const date = text(entry.Date) || todayISO()
  const restock = restockNode({
    OutletCode: outletCode,
    Date: date,
    // Left out when unknown, so restockNode's own default (the signed-in user) stands.
    ...(text(entry.Username) || text(actorName) ? { RequestedUser: text(entry.Username) || text(actorName) } : {}),
    OutletConsumptionCode: linkToConsumption
      ? textOrRef(consumptionRef || batchRef(`${CONSUMPTIONS}.latest.code`))
      : ''
  }, splitRows, {
    ...flags,
    linkToConsumption,
    ...(text(comment) ? { origin: text(comment) } : {})
  }, { withDerive: false })

  const movements = buildRestockMovementNodes({
    outletCode,
    warehouseCode: flags.warehouseCode,
    date,
    items: splitRows,
    direct: flags.direct,
    deliver: flags.deliver
  })

  return [
    { ...restock, successMsg: flags.draft ? 'Restock request saved as draft.' : 'Restock request submitted.' },
    ...movements
  ]
}

export function useRestockCreation () {
  return {
    RESTOCK_REF_PATH,
    RESTOCK_CONTROL,
    buildRestockChainNodes,
    buildRestockMovementNodes,
    defaultSubmissionComment,
    deriveParentRestockProgress,
    restockDirectOptions,
    restockNode,
    restockNodeForConsumption,
    restockItemRow,
    restockFlags,
    restockItemProgress,
    restockProgressDerive,
    restockSubmissionNodes,
    syncRestockInPageState,
    syncRestockLedgersInPageState,
    syncRestockProgressInPageState
  }
}
