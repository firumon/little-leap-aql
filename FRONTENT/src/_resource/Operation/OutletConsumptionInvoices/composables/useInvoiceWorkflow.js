/**
 * OutletConsumptionInvoices › the workflow vocabulary and its gates — Layer 2.
 *
 * "What state is this invoice in, what may it become next, and is this user allowed to move
 * it there" has exactly one answer, computed here, for every UI that ever renders an
 * invoice (UI_RESOURCE_DOMAIN_LOGIC.md §3.3 — one vocabulary per resource, never a second
 * copy).
 *
 * ── THE STATE MACHINE ──
 *
 *     PENDING_PAYMENT ──(partial payment)──► PARTIALLY_PAID ──(final payment)──► PAID
 *            │                                      │                             ▲
 *            └──────────────(full payment)──────────┴─────────────────────────────┘
 *            │
 *            └──(cancel)──► CANCELLED
 *
 * The walk is driven by MONEY, not by a button: `progressForBalance` derives the state an
 * invoice should be in from what is still owed, and the payment flow executes whatever
 * transition that implies. This is why a reversed payment correctly walks a PAID invoice
 * back to PARTIALLY_PAID without anyone modelling a "reversal" transition — the balance
 * went up, so the derived state changed.
 *
 * The one transition money does NOT drive is `MarkPaid` as a FORCED SETTLEMENT: closing an
 * invoice while a real balance remains, with a reason recorded for the gap. That is a
 * decision, so it is the one that demands a justification.
 *
 * PURE (§3, §5): predicates take `record`/`records` only, never a config — the composable
 * already knows which resource it is (§3.2).
 */

import { useAuthStore } from 'src/stores/auth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { balanceDueOf, grandTotalOf } from './useInvoiceCalculation'

const RESOURCE_NAME = 'OutletConsumptionInvoices'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// ─── The vocabulary ───────────────────────────────────────────────────────────

export const PENDING_PAYMENT = 'PENDING_PAYMENT'
export const PARTIALLY_PAID = 'PARTIALLY_PAID'
export const PAID = 'PAID'
export const CANCELLED = 'CANCELLED'

/**
 * The single definition of how each state is labelled, coloured and iconed.
 *
 * Every chip, badge, list header and timeline entry in every UI reads this map. A caller
 * needing extra, narrower states spreads over it rather than restating its entries (§3.3).
 */
export const PROGRESS_META = {
  [PENDING_PAYMENT]: { label: 'Unpaid', color: 'orange', icon: 'schedule' },
  [PARTIALLY_PAID]: { label: 'Partially Paid', color: 'teal-7', icon: 'incomplete_circle' },
  [PAID]: { label: 'Paid', color: 'positive', icon: 'task_alt' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

/** The states an invoice is still collecting money in. */
export const OPEN_STATES = [PENDING_PAYMENT, PARTIALLY_PAID]

/** The states nothing further happens from. */
export const TERMINAL_STATES = [PAID, CANCELLED]

/**
 * The settlement reasons `MarkPaid` accepts.
 *
 * MIRRORS `APP_OPTIONS_SEED.OutletConsumptionInvoiceSettlementReasons` in `GAS/Constants.gs`,
 * which is also what seeds the action's own `options` array — so the dialog's choices come
 * from the backend config and this list exists only for the `OTHER` comparison below. It is
 * deliberately not the source the dialog renders from; that would be the second copy §3.3
 * warns about.
 */
export const SETTLEMENT_OTHER = 'Other'

/**
 * The reason list itself, read from the synced `AppOptions` so the dialog, the payment
 * waiver and the sheet's own data validation all offer one list. A second array compiled
 * into a screen writes values the sheet then rejects.
 */
export function settlementReasons () {
  const options = useAuthStore().appOptionsMap?.OutletConsumptionInvoiceSettlementReasons
  return (Array.isArray(options) ? options : []).map(text).filter(Boolean)
}

export function progressOf (record) {
  return text(asRow(record).Progress).toUpperCase()
}

export function progressMetaOf (record) {
  return PROGRESS_META[progressOf(record)] || { label: text(asRow(record).Progress) || 'Unknown', color: 'grey-6', icon: 'help' }
}

export function isOpen (record) {
  return OPEN_STATES.includes(progressOf(record))
}

export function isCancelled (record) {
  return progressOf(record) === CANCELLED
}

export function isPaid (record) {
  return progressOf(record) === PAID
}

// ─── Money-driven transitions ─────────────────────────────────────────────────

/**
 * The state an invoice SHOULD be in, given what is still owed on it.
 *
 * A cancelled invoice stays cancelled whatever its balance says — cancellation is a
 * decision about the document, and a stray payment landing against it must not silently
 * resurrect it into the collections queue.
 *
 * PAID IS EXACT. Money alone closes an invoice only when nothing at all is left. A residue
 * of one cent is still a residue, and the only route from there to PAID is the audited
 * `MarkPaid` settlement, which records WHY the gap was accepted. Letting a sub-interval
 * remainder flip the state on its own is the unaudited leakage this rule exists to stop —
 * the invoice sits in PARTIALLY_PAID until somebody signs for the difference.
 */
export function progressForBalance (record = {}, balance = 0) {
  if (isCancelled(record)) return CANCELLED
  if (num(balance) <= 0) return PAID
  return num(balance) < grandTotalGuard(record, balance) ? PARTIALLY_PAID : PENDING_PAYMENT
}

/**
 * The whole bill, to compare an outstanding balance against. Tax-inclusive and ACTUAL, from
 * the one pricing engine — comparing a tax-inclusive balance to a tax-excluded total is what
 * kept part-paid invoices stuck in PENDING_PAYMENT.
 */
function grandTotalGuard (record, balance) {
  const total = grandTotalOf(asRow(record))
  // A zero total cannot tell "partly paid" from "untouched"; fall back to the balance so
  // the invoice stays PENDING_PAYMENT rather than claiming a payment nobody made.
  return total > 0 ? total : num(balance)
}

/**
 * The transition a new balance implies, or `null` when the invoice is already in that state.
 *
 * Returning `null` for a no-op is what stops the payment flow appending a redundant
 * `executeAction` to every batch — an action that would stamp `ProgressPaidAt` a second
 * time and overwrite the real settlement timestamp with a later one.
 */
export function transitionForBalance (record = {}, balance = 0) {
  const next = progressForBalance(record, balance)
  if (next === progressOf(record)) return null
  if (next === PAID) return { action: 'MarkPaid', columnValue: PAID, stamp: 'ProgressPaid', comment: 'Paid in full.' }
  if (next === PARTIALLY_PAID) return { action: 'MarkPartiallyPaid', columnValue: PARTIALLY_PAID, stamp: 'ProgressPartiallyPaid', comment: 'Payment received; balance outstanding.' }
  return { action: 'MarkPendingPayment', columnValue: PENDING_PAYMENT, stamp: 'ProgressPendingPayment', comment: 'Payment reversed; balance outstanding.' }
}

// ─── Permission gates ─────────────────────────────────────────────────────────

/**
 * Every gate below resolves this resource's own config by NAME, never from the route
 * (§3.2), so an invoice card rendered inside an outlet page or a payments page still gates
 * on the invoice resource's real permissions.
 */
const gate = () => useResourceConfig(RESOURCE_NAME)

export function canCreateInvoice () {
  return !!gate().allowed({ outletConsumptionInvoice: 'create' })
}

/** Editable only while nothing has been collected and the document is still open. */
export function canEditInvoice (record) {
  return !!gate().allowed({ outletConsumptionInvoice: 'update' }) && progressOf(record) === PENDING_PAYMENT
}

export function canRecordPayment (record) {
  return !!gate().allowed({ outletConsumptionInvoice: 'update' }) && isOpen(record)
}

/**
 * Forced settlement claims the registered `markPaid` action, not generic `update`: a role
 * granted canMarkPaid without record-edit rights must still be able to settle. Gated
 * additionally on the document still being open — a PAID invoice has nothing to settle and
 * a CANCELLED one must not be resurrected into PAID.
 */
export function canMarkPaid (record) {
  return !!gate().allowed({ outletConsumptionInvoice: 'markPaid' }) && isOpen(record)
}

/**
 * Cancellation is OWNER-ONLY and never available once money has been collected.
 *
 * The owner check is delegated to the config's own `allowed` map rather than compared here
 * against a username: `RecordAccessPolicy: 'OWNER_AND_UPLINE'` on this resource already
 * means the backend refuses a cancel from anyone outside that set, and re-deriving the rule
 * on the client would be a second implementation that can disagree with the one that
 * actually enforces it.
 */
export function canCancelInvoice (record) {
  return !!gate().allowed({ outletConsumptionInvoice: 'cancel' }) && progressOf(record) === PENDING_PAYMENT
}

// ─── Forced settlement ────────────────────────────────────────────────────────

/**
 * Can this invoice be force-settled right now, and what is the gap?
 *
 * ONE predicate behind the FAB gate, the route's lock banner and the submit veto (§8.6), and
 * it also answers the three figures the route displays — so the settle page derives nothing
 * of its own and cannot show a balance the builder disagrees with.
 *
 * NO PERMISSION CHECK, deliberately: `PageAction.js` calls this from outside `setup()`, where
 * `useResourceConfig()` cannot run. Permission travels back in the builder's envelope and
 * Layer 3 gates on it — the same split `validateInvoiceDraft` documents. `canMarkPaid` stays
 * for the FAB, which IS in setup.
 *
 * `payments` is the invoice's own payment rows; `useInvoiceIndex` is what joins them.
 */
export function settlementGate (record = {}, payments = []) {
  const entry = asRow(record)
  const total = grandTotalOf(entry)
  const balance = balanceDueOf(entry, payments)
  const figures = {
    total,
    balance,
    collected: Math.max(0, num((total - balance).toFixed(2))),
    // What the invoice would write off if the user accepts the whole gap. A starting value,
    // not a forced one — a part-waiver is a real case.
    suggestedMismatch: num(balance.toFixed(2))
  }
  if (isCancelled(entry)) return { ...figures, allowed: false, reason: 'This invoice was cancelled — there is nothing to settle.' }
  if (isPaid(entry)) return { ...figures, allowed: false, reason: 'This invoice is already paid.' }
  if (!isOpen(entry)) return { ...figures, allowed: false, reason: 'This invoice is not open for settlement.' }
  return { ...figures, allowed: true, reason: '' }
}

/**
 * Validate a `MarkPaid` settlement before it is dispatched.
 *
 * THE RULE GAS CANNOT EXPRESS. An action field's `required` flag is static — it has no
 * dependency on a sibling field's value — so "the comment is mandatory when the reason is
 * `Other`" cannot be declared in `syncAppResources.gs` and is enforced here instead, which
 * is the one place both values are known before dispatch. `Other` means "none of the
 * reasons we listed", which is precisely the case where the free-text explanation is the
 * only record of what happened.
 *
 * The mismatch amount DEFAULTS to the outstanding balance — the whole point of the action
 * is to write off exactly what is left — but is not forced to it, because a part-waiver
 * (settle 90, write off 10) is a real case.
 */
export function validateSettlement ({ record = {}, reason = '', comment = '', mismatchAmount = null, balanceDue = 0 } = {}) {
  // NO PERMISSION CHECK HERE — see the note on `validateInvoiceDraft`. The settlement's
  // `permissions` map travels back in the envelope and Layer 3 gates on it.
  if (!isOpen(record)) {
    return { valid: false, message: 'This invoice is already settled or cancelled.' }
  }
  if (!text(reason)) {
    return { valid: false, message: 'Select a settlement reason.' }
  }
  if (text(reason) === SETTLEMENT_OTHER && !text(comment)) {
    return { valid: false, message: 'A comment is required when the settlement reason is "Other".' }
  }

  const mismatch = mismatchAmount === null || mismatchAmount === '' ? num(balanceDue) : num(mismatchAmount)

  return {
    valid: true,
    settlement: {
      SettlementReason: text(reason),
      SettlementMismatchAmount: mismatch,
      Comment: text(comment)
    }
  }
}

/**
 * Was this invoice force-settled with a gap between billed and collected?
 *
 * Drives the View page's settlement banner. A zero mismatch is NOT a settlement worth
 * announcing — it means the invoice was marked paid at exactly its balance, which is just
 * an ordinary payment recorded by a different route.
 */
export function settlementOf (record = {}) {
  const entry = asRow(record)
  const mismatch = num(entry.SettlementMismatchAmount)
  if (!mismatch) return null
  return {
    amount: mismatch,
    reason: text(entry.SettlementReason) || 'Not stated',
    comment: text(entry.ProgressPaidComment),
    by: text(entry.ProgressPaidBy),
    at: text(entry.ProgressPaidAt)
  }
}

/**
 * Validate an invoice draft before it is built into requests.
 *
 * Called by `useInvoicePayload.js` rather than by the wizard, so the same rules apply
 * however an invoice is generated — from this module's Add page, or chained from a
 * consumption submit.
 */
export function validateInvoiceDraft ({ outletCode = '', priceListCode = '', lines = [], dueDate = '' } = {}) {
  // ── NO PERMISSION CHECK HERE, DELIBERATELY ──
  // This runs inside the payload builder, which a `PageAction.js` submit handler calls from
  // OUTSIDE any component `setup()`. Every permission gate goes through
  // `useResourceConfig()`, which calls `useRouteConfig()` → `useRoute()` → `inject()`
  // unconditionally — even when handed an explicit resource name it never uses the route for
  // — so calling one here raised "inject() can only be used inside setup()" on every submit.
  //
  // It was also redundant: a builder returns its `permissions` map in the envelope and
  // Layer 3 gates the whole chain with one `resourceConfig.allowed(result.permissions)`
  // before dispatching (CORE_ARCHITECTURE_RULES §5, UI_RESOURCE_DOMAIN_LOGIC §9.2). Checking
  // it twice, once from a context that cannot support it, bought nothing.
  //
  // `canCreateInvoice` remains exported for UI gating, where it IS called from setup.
  if (!text(outletCode)) {
    return { valid: false, message: 'Select an outlet to invoice.' }
  }
  if (!text(priceListCode)) {
    return { valid: false, message: 'No price list is configured for this outlet, and there is no default. Set one before invoicing.' }
  }

  const billable = (Array.isArray(lines) ? lines : []).map(asRow)
    .filter((line) => text(line.SKU) && num(line.Qty ?? line.SoldQty) > 0)

  if (!billable.length) {
    return { valid: false, message: 'Add at least one item with a quantity before generating the invoice.' }
  }
  if (billable.some((line) => num(line.Price) < 0)) {
    return { valid: false, message: 'An item has a negative unit price. Correct it before generating the invoice.' }
  }
  if (!text(dueDate)) {
    return { valid: false, message: 'Set a due date for the invoice.' }
  }

  return { valid: true, lines: billable }
}

/** Convenience for callers that already hold the payment rows. */
export function balanceStateOf (record = {}, payments = []) {
  const balance = balanceDueOf(record, payments)
  return { balance, progress: progressForBalance(record, balance), transition: transitionForBalance(record, balance) }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useInvoiceWorkflow () {
  return {
    PENDING_PAYMENT,
    PARTIALLY_PAID,
    PAID,
    CANCELLED,
    PROGRESS_META,
    OPEN_STATES,
    TERMINAL_STATES,
    SETTLEMENT_OTHER,
    settlementReasons,
    progressOf,
    progressMetaOf,
    isOpen,
    isPaid,
    isCancelled,
    progressForBalance,
    transitionForBalance,
    balanceStateOf,
    canCreateInvoice,
    canEditInvoice,
    canRecordPayment,
    canMarkPaid,
    canCancelInvoice,
    settlementGate,
    validateSettlement,
    settlementOf,
    validateInvoiceDraft
  }
}
