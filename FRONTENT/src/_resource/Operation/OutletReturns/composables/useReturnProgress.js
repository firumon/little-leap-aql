
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { sortByDate } from 'src/utils/sortHelpers'

// Re-exported so a consumer that already imports this file for the workflow vocabulary
// does not need a second import line to sort the rows it just filtered.
export { sortByDate }

const RESOURCE_NAME = 'OutletReturns' // this composable IS OutletReturns — always

export const SUBMITTED = 'SUBMITTED'
export const COMPLETED = 'COMPLETED'
export const CANCELLED = 'CANCELLED'

export const AWAITING_INVOICE_ADJUSTMENT = 'AWAITING_INVOICE_ADJUSTMENT'
export const AWAITING_WAREHOUSE_RECEIPT = 'AWAITING_WAREHOUSE_RECEIPT'

/** The legacy pair, named so a migration or a report can address them as a set. */
export const LEGACY_STATES = [AWAITING_INVOICE_ADJUSTMENT, AWAITING_WAREHOUSE_RECEIPT]

/** Every state the Progress column may hold — the backend enum, in walk order. */
export const WORKFLOW_STATES = [
  SUBMITTED,
  AWAITING_INVOICE_ADJUSTMENT,
  AWAITING_WAREHOUSE_RECEIPT,
  COMPLETED,
  CANCELLED
]

export const TERMINAL_STATES = [COMPLETED, CANCELLED]

export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

export const PROGRESS_META = {
  [SUBMITTED]: { label: 'Submitted', color: 'warning', icon: 'assignment_return' },
  [AWAITING_INVOICE_ADJUSTMENT]: { label: 'Awaiting Invoice Credit', color: 'info', icon: 'receipt_long' },
  [AWAITING_WAREHOUSE_RECEIPT]: { label: 'Awaiting Warehouse Receipt', color: 'purple', icon: 'warehouse' },
  [COMPLETED]: { label: 'Completed', color: 'positive', icon: 'check_circle' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

/** What an unmapped state renders as. Its `label` is only ever reached for a BLANK state. */
export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const STOCKED = 'Stocked'
export const DISPOSED = 'Disposed'

export const WAREHOUSE_ACTION_META = {
  [STOCKED]: { label: 'Stocked', color: 'positive', icon: 'store' },
  [DISPOSED]: { label: 'Disposed', color: 'negative', icon: 'delete_outline' }
}

/** The seven reason codes, with the labels the Add page's selector renders. */
export const REASON_META = {
  DAMAGE: { label: 'Damage', icon: 'report_problem' },
  EXPIRED: { label: 'Expired', icon: 'event_busy' },
  SLOW_MOVING: { label: 'Slow Moving', icon: 'trending_down' },
  RECALL: { label: 'Recall', icon: 'gpp_bad' },
  OVERSTOCK: { label: 'Overstock', icon: 'inventory_2' },
  SPECIFICATION_MISMATCH: { label: 'Specification Mismatch', icon: 'swap_horiz' },
  OTHER: { label: 'Other', icon: 'help_outline' }
}

export const REASONS = Object.keys(REASON_META)

/** The one reason that cannot stand without an explanation. */
export const REASON_REQUIRING_COMMENT = 'OTHER'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function isFlagged (value) {
  return value === true || text(value).toUpperCase() === 'TRUE'
}

/** Normalized Progress value, tolerant of casing and stray whitespace from the sheet. */
export function progressOf (record) {
  return text(asRow(record).Progress).toUpperCase()
}

export function progressColor (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function progressIcon (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function progressLabel (state) {
  const raw = text(state).toUpperCase()
  // An unmapped-but-present state states itself rather than reading as blank.
  return PROGRESS_META[raw]?.label || raw || FALLBACK_META.label
}

export function reasonLabel (reason) {
  const raw = text(reason).toUpperCase()
  return REASON_META[raw]?.label || raw || FALLBACK_META.label
}

export function reasonIcon (reason) {
  return REASON_META[text(reason).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function warehouseActionLabel (record) {
  const action = text(asRow(record).WarehouseAction)
  return WAREHOUSE_ACTION_META[action]?.label || ''
}

export function warehouseActionColor (record) {
  const action = text(asRow(record).WarehouseAction)
  return WAREHOUSE_ACTION_META[action]?.color || FALLBACK_META.color
}

export function warehouseActionIcon (record) {
  const action = text(asRow(record).WarehouseAction)
  return WAREHOUSE_ACTION_META[action]?.icon || FALLBACK_META.icon
}

/** A blank Status is Active — the sheet only writes the column when it is set. */
export function isActiveRow (record) {
  return text(asRow(record).Status || 'Active') === 'Active'
}

export function isSubmitted (record) {
  return progressOf(record) === SUBMITTED
}

export function isCompleted (record) {
  return progressOf(record) === COMPLETED
}

export function isCancelled (record) {
  return progressOf(record) === CANCELLED
}

/** Whether a row has come to rest — completed or cancelled. */
export function isTerminal (record) {
  return TERMINAL_STATES.includes(progressOf(record))
}

export function isOpen (record) {
  return !isTerminal(record)
}

export function invoiceAdjustmentRequired (record) {
  return isFlagged(asRow(record).InvoiceAdjustmentRequired)
}

export function invoiceAdjustmentDone (record) {
  return isFlagged(asRow(record).InvoiceAdjustmentDone)
}

export function warehouseActionRequired (record) {
  return isFlagged(asRow(record).WarehouseActionRequired)
}

export function warehouseActionCompleted (record) {
  return isFlagged(asRow(record).WarehouseActionCompleted)
}

/** The commercial track is settled — either it was never owed, or it has been credited. */
export function invoiceTrackSettled (record) {
  return !invoiceAdjustmentRequired(record) || invoiceAdjustmentDone(record)
}

/** The physical track is settled — either nothing had to move, or it has moved. */
export function warehouseTrackSettled (record) {
  return !warehouseActionRequired(record) || warehouseActionCompleted(record)
}

export function isReturnCompleted (record) {
  return invoiceTrackSettled(record) && warehouseTrackSettled(record)
}

export function returnRequiresTrack (record) {
  return invoiceAdjustmentRequired(record) || warehouseActionRequired(record)
}

export function isEditable (record) {
  return !isTerminal(record) &&
    !invoiceAdjustmentDone(record) &&
    !warehouseActionCompleted(record)
}

// Each gate claims its OWN registered action, not generic `update`: a role granted
// canWarehouseAction without record-edit rights must still be able to settle that leg.
function may (action) {
  return !!useResourceConfig(RESOURCE_NAME).allowed(action)
}

/** A return may be cancelled at any point before it comes to rest. */
export function canCancel (record) {
  return may('cancel') && isOpen(record)
}

/** The warehouse leg is owed and unresolved — the `WarehouseAction` route's show condition. */
export function canConfirmWarehouseAction (record) {
  return may('warehouseAction') && warehouseActionRequired(record) && !warehouseActionCompleted(record)
}

/** The credit is owed and unresolved — the `MarkInvoiceAdjusted` route's show condition. */
export function canMarkInvoiceAdjusted (record) {
  return may('markInvoiceAdjusted') && invoiceAdjustmentRequired(record) && !invoiceAdjustmentDone(record)
}

export const TIMELINE_EVENTS = [
  { key: 'created', title: 'Return Logged', atField: 'CreatedAt', byField: 'CreatedBy', icon: 'assignment_return', color: 'primary' },
  { key: 'stocked', title: 'Stocked to Warehouse', atField: 'WarehouseActionStockedAt', byField: 'WarehouseActionStockedBy', icon: 'store', color: 'positive' },
  { key: 'disposed', title: 'Disposed', atField: 'WarehouseActionDisposedAt', byField: 'WarehouseActionDisposedBy', commentField: 'WarehouseActionDisposedReason', icon: 'delete_outline', color: 'negative' },
  { key: 'updated', title: 'Last Updated', atField: 'UpdatedAt', byField: 'UpdatedBy', icon: 'edit', color: 'grey-7' }
]

export function workflowStamps (record) {
  const row = asRow(record)
  return TIMELINE_EVENTS
    .map((event) => {
      const at = text(row[event.atField])
      const parsed = at ? new Date(at) : null
      return {
        key: event.key,
        title: event.title,
        at,
        by: text(row[event.byField]),
        comment: event.commentField ? text(row[event.commentField]) : '',
        icon: event.icon,
        color: event.color,
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

export function returnValueOf (record) {
  const row = asRow(record)
  const qty = Math.abs(Number(row.Qty) || 0)
  const price = Number(row.Price) || 0
  return Math.round(qty * price * 100) / 100
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useReturnProgress () {
  return {
    RESOURCE_NAME,
    SUBMITTED,
    COMPLETED,
    CANCELLED,
    AWAITING_INVOICE_ADJUSTMENT,
    AWAITING_WAREHOUSE_RECEIPT,
    LEGACY_STATES,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    PROGRESS_META,
    FALLBACK_META,
    WAREHOUSE_ACTION_META,
    STOCKED,
    DISPOSED,
    REASON_META,
    REASONS,
    REASON_REQUIRING_COMMENT,
    TIMELINE_EVENTS,
    isFlagged,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    reasonLabel,
    reasonIcon,
    warehouseActionLabel,
    warehouseActionColor,
    warehouseActionIcon,
    isActiveRow,
    isSubmitted,
    isCompleted,
    isCancelled,
    isTerminal,
    isOpen,
    invoiceAdjustmentRequired,
    invoiceAdjustmentDone,
    warehouseActionRequired,
    warehouseActionCompleted,
    invoiceTrackSettled,
    warehouseTrackSettled,
    isReturnCompleted,
    returnRequiresTrack,
    isEditable,
    canCancel,
    canConfirmWarehouseAction,
    canMarkInvoiceAdjusted,
    workflowStamps,
    returnValueOf,
    sortByDate
  }
}
