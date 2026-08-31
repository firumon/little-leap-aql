import { planAllocatedQty } from 'src/_resource/Operation/OutletRestocks/composables/useRestockAllocation'
import { readApprovalPlan } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockApproval'

/**
 * OutletRestocks › Reallocate › PageAction — JS modifier (tier 2: resource + page).
 *
 * Drives the 2-step reallocation entirely from the sticky bar, so the cards stay
 * pure inputs with no navigation or dispatch of their own:
 *
 *   step 1  warehouse + allocation  →  [ Cancel ] [ Continue       ]
 *   step 2  review                  →  [ Back   ] [ Allocate Stock ]
 *
 * A focused fork of `Approve/PageAction.js`'s later-allocation path. The approval
 * page serves two situations behind one `isInitialApproval()` branch — deciding a
 * PENDING_APPROVAL request, and allocating the leftovers of one already decided.
 * This page is only ever the second, so the branch, the initial-approval payload
 * builder and the conditional submit label all collapse away:
 *
 *   • no `isInitialApproval` — the request is PARTIALLY_DELIVERED by definition
 *   • no `splitApprovalRows` / `buildRestockAllocationNodes`
 *   • no `reject` — a request that has already delivered stock cannot be
 *     rejected, and `Approve/PageAction.js` blocks exactly that case
 *   • `submitLabel` is the static `'Allocate Stock'`, not a getter
 *
 * THE PARENT RECORD IS NEVER WRITTEN. Reallocating settles child lines and moves
 * stock; the request stays PARTIALLY_DELIVERED until a delivery says otherwise.
 * `buildPendingRestockAllocationNodes` emits only `OutletRestockItems`
 * and `StockMovements` requests, and nothing here adds an `OutletRestocks` one.
 * That is also why `permitted()` asks for stock-write permission rather than
 * `approve` — no approval is taking place.
 *
 * `actions` is a GETTER, not a literal array. `useActionResolver` calls this
 * factory once per resolve and caches the result, but merges it into `finalProps`
 * inside a `computed` — so a getter is re-read on every recompute and its reads of
 * `pageState.meta.currentStep` are tracked. A literal array would latch the step-1
 * button set forever (UI_ACTION_SYSTEM.md §1.3).
 *
 * This modifier runs OUTSIDE a setup context, so it cannot call
 * `useRestockApproval()` (which injects and mounts). It does not need to: the
 * approver's decision is already fully materialized in the LIVE nodes that
 * `useRestockApproval` applies on every allocation change. THE HANDLERS ONLY
 * VALIDATE — there is nothing left to build at submit, so nothing here mutates
 * state.
 */
const CHILD = 'OutletRestockItems'

const text = (value) => String(value ?? '').trim()

// `childRecordsByResource` is built from the same `enrichRecord` mapping as
// `useRecord().items`, so it can carry `null` for a row whose Code has not landed
// yet. Normalizing to an object BEFORE any predicate is what stops a null from
// passing the Status guard and then being dereferenced by the next read — the
// failure mode `useRestockApproval.js` documents on `asRow`.
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const step = () => pageState.meta.currentStep
  const restock = () => resourceRecord?.record?.value || {}
  const plan = () => readApprovalPlan(pageState)

  // Only PENDING lines are allocatable — a DELIVERED or ALLOCATED line is settled
  // history, and on a PARTIALLY_DELIVERED request most of them are.
  function pendingItems () {
    const rows = (resourceRecord?.childRecordsByResource?.value || {})[CHILD]
    if (!Array.isArray(rows)) return []
    return rows
      .map(asRow)
      .filter((row) => text(row.Code) && isActive(row) && (text(row.Progress) || 'PENDING') === 'PENDING')
  }

  function entryFor (item) {
    return plan()[text(item.Code)] || {}
  }

  const allocatedItems = () => pendingItems().filter((item) => planAllocatedQty(entryFor(item)) > 0)

  // A remainder is cancellable only when it actually exists: cancelling a line
  // that was fully allocated would strike out stock just committed.
  function cancelledItems () {
    return pendingItems().filter((item) => {
      const entry = entryFor(item)
      const remainder = Number(item.Quantity || 0) - planAllocatedQty(entry)
      return entry.cancelled === true && remainder > 0
    })
  }

  const totalAllocated = () => pendingItems().reduce((sum, item) => sum + planAllocatedQty(entryFor(item)), 0)

  // Claims the registered `reallocate` action plus the stock writes the batch makes.
  // `approve` is deliberately absent: reallocating commits units to an outlet that was
  // approved long ago, it re-decides nothing. Action names are lower-case on purpose —
  // `checkSingleAction` upper-cases the FIRST character only (`create` → `canCreate`).
  function permitted () {
    return resourceConfig?.allowed({
      OutletRestocks: 'reallocate', OutletRestockItems: 'create', StockMovements: 'create'
    })
  }

  return {
    get actions () {
      if (step() === 2) return ['back', 'submit']
      return ['cancel', 'next']
    },

    // Static: this page has exactly one outcome, unlike the approval bar whose
    // label has to follow the request's own state.
    submitLabel: 'Allocate Stock',

    // Leaving abandons an unsaved plan, so return to the request itself rather
    // than `goBack()` — the approver may have arrived from the list. Returning
    // false stops the built-in goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    // Step 1 → 2. Nothing to review unless the approver has either committed
    // stock or explicitly written off a remainder.
    next: () => {
      if (!pendingItems().length) return { valid: false, message: 'This request has no pending items to allocate.' }
      if (!totalAllocated() && !cancelledItems().length) {
        return { valid: false, message: 'Allocate stock to at least one item, or mark a shortfall as cancelled, to continue.' }
      }
      return
    },

    /**
     * Allocate the leftovers, as one batch.
     *
     * Negative `StockMovements` for every allocated bin — the units leave the
     * warehouse the moment they are committed to an outlet, not when they are
     * delivered. Delivery remains a separate, later operation.
     *
     * The builder groups by source Code and decides for itself whether each
     * source row is reused, shrunk to a remainder, or deactivated, so only rows
     * carrying allocations are handed to it.
     */
    submit: () => {
      const parent = restock()
      if (!text(parent.Code)) return { valid: false, message: 'This restock request could not be loaded.' }
      if (!permitted()) return { valid: false, message: 'You are not allowed to allocate stock for this request.' }
      if (!allocatedItems().length) {
        return { valid: false, message: 'Allocate stock to at least one pending item before continuing.' }
      }

      return { successMsg: 'Stock allocated to the pending items.' }
    },

    successRoute: 'view'
  }
}
