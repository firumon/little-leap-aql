import { useAuth } from 'src/composables/core/useAuth'
import { resourceGetRequest } from 'src/composables/resources/usePageState'
import {
  buildPendingRestockAllocationBatchRequests,
  buildRestockAllocationBatchRequests,
  buildRestockCancelItemsBatchRequests,
  buildRestockRejectBatchRequests
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import {
  pendingAllocationRows,
  planAllocatedQty,
  splitApprovalRows
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockAllocation'

/**
 * OutletRestocks › Approve › PageAction — JS modifier (tier 2: resource + page).
 *
 * Drives the 2-step approval entirely from the sticky bar, so the cards stay pure
 * inputs with no navigation or dispatch of their own:
 *
 *   step 1  warehouse + allocation  →  [ Cancel ] [ Reject ] [ Continue ]
 *   step 2  review                  →  [ Back   ] [ Reject ] [ Approve  ]
 *
 * `actions` is a GETTER, not a literal array. `useActionResolver` calls this
 * factory once per resolve and caches the result, but merges it into `finalProps`
 * inside a `computed` — so a getter is re-read on every recompute and its reads of
 * `pageState.meta.currentStep` are tracked. A literal array would latch the step-1
 * button set forever (UI_ACTION_SYSTEM.md §1.3).
 *
 * This modifier runs OUTSIDE a setup context, so it cannot call
 * `useRestockApproval()` (which injects and mounts). It does not need to: the
 * approver's decision is already fully materialized in the `ApprovalPlan` control
 * field, and the item rows come off the injected `resourceRecord`. Only the PURE
 * exports of that composable are imported here — the same functions the cards
 * render from, so what is submitted is what step 2 displayed.
 */
const PARENT = 'OutletRestocks'
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
  // Safe outside setup: `useAuth` only reaches Pinia stores and statically
  // imported Quasar plugins — it calls no `inject()`. `user` stays a computed, so
  // reading it at submit time gives the live session user.
  const { user } = useAuth()

  const step = () => pageState.meta.currentStep
  const restock = () => resourceRecord?.record?.value || {}
  const plan = () => pageState.getControlField(PARENT, 'ApprovalPlan') || {}
  const comment = () => text(pageState.getControlField(PARENT, 'ApprovalComment'))
  const actor = () => user.value?.name || user.value?.email || ''

  // A restock still awaiting a decision is being APPROVED (the parent moves to
  // APPROVED); one already approved is having its leftover PENDING lines
  // allocated later. The two need different payload builders, and the label and
  // the permission gate differ with them.
  const isInitialApproval = () => text(restock().Progress) === 'PENDING_APPROVAL'

  // Only PENDING lines are allocatable — everything else is settled history.
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
  // that was fully allocated would strike out stock the approver just committed.
  function cancelledItems () {
    return pendingItems().filter((item) => {
      const entry = entryFor(item)
      const remainder = Number(item.Quantity || 0) - planAllocatedQty(entry)
      return entry.cancelled === true && remainder > 0
    })
  }

  const totalAllocated = () => pendingItems().reduce((sum, item) => sum + planAllocatedQty(entryFor(item)), 0)

  // Cancelling a remainder writes no stock movement — the units were never taken
  // out of the warehouse — so it is an `executeAction` stamp, dispatched after the
  // bulk write that (re)creates the row it targets.
  function cancelRequests () {
    const rows = cancelledItems().map((item) => ({ Code: text(item.Code), Progress: 'PENDING' }))
    if (!rows.length) return []
    return buildRestockCancelItemsBatchRequests(restock(), rows, actor(), comment() || 'Cancelled: no warehouse stock available.')
  }

  // Action names are lower-case on purpose. `checkSingleAction` derives the
  // permission key by upper-casing the FIRST character only (`approve` →
  // `canApprove`), so an all-caps `'APPROVE'` resolves to `canAPPROVE` and can
  // never match — it fails closed and silently blocks the button.
  function permitted () {
    return isInitialApproval()
      ? resourceConfig?.allowed({ OutletRestocks: 'approve', OutletRestockItems: 'create', StockMovements: 'create' })
      : resourceConfig?.allowed({ OutletRestockItems: 'create', StockMovements: 'create' })
  }

  return {
    // Approve-or-leave. Rejection is NOT offered here: this page exists to decide
    // where stock comes from, and a reject needs no allocation plan at all. It
    // stays on the request's own View page, alongside the other workflow actions,
    // where it is reachable without first walking an allocation wizard.
    //
    // The `reject` HANDLER below is intentionally retained — it is dispatched by
    // name, so it stays available to any tier that re-adds the button (a
    // `PropsPageAction: { actions: [...] }` block, or a tenant modifier) without
    // having to restate the reversal logic.
    get actions () {
      if (step() === 2) return ['back', 'submit']
      return ['cancel', 'next']
    },

    // A getter for the same reason `actions` is one — the label has to follow the
    // restock's own state, not the state it happened to be in at resolve time.
    get submitLabel () { return isInitialApproval() ? 'Approve Request' : 'Allocate Stock' },

    // Leaving an approval abandons an unsaved plan, so return to the request
    // itself rather than `goBack()` — the approver may have arrived from the list.
    // Returning false stops the built-in goBack() popping a second history entry.
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
     * Approve (or allocate later), as one batch.
     *
     * Both paths write negative `StockMovements` for every allocated bin — the
     * units leave the warehouse the moment they are committed to an outlet, not
     * when they are delivered. Delivery is a separate, later operation.
     */
    submit: () => {
      const parent = restock()
      if (!text(parent.Code)) return { valid: false, message: 'This restock request could not be loaded.' }
      if (!permitted()) return { valid: false, message: 'You are not allowed to approve this restock request.' }

      const allocated = allocatedItems()
      if (!allocated.length) {
        return { valid: false, message: 'Allocate stock to at least one item before approving. Reject the request if nothing can be fulfilled.' }
      }

      if (isInitialApproval()) {
        // `splitApprovalRows` attaches the original row's Code to exactly one
        // emitted row, so no Code is written twice in the same batch.
        const rows = pendingItems().flatMap((item) => splitApprovalRows(item, entryFor(item)))
        return {
          requests: [
            ...buildRestockAllocationBatchRequests(parent, rows, actor(), comment()),
            ...cancelRequests(),
            // The allocation just changed on-hand stock; pull the recalculated
            // storages back in the same round trip rather than on the next page load.
            resourceGetRequest(['WarehouseStorages'])
          ],
          successMsg: 'Restock request approved and stock allocated.'
        }
      }

      // Later allocation: the builder groups by source Code and decides for
      // itself whether each source row is reused, shrunk to a remainder, or
      // deactivated, so only rows carrying allocations are handed to it.
      const rows = allocated.flatMap((item) => pendingAllocationRows(item, entryFor(item)))
      return {
        requests: [
          ...buildPendingRestockAllocationBatchRequests(parent, rows, actor(), comment()),
          ...cancelRequests(),
          resourceGetRequest(['WarehouseStorages'])
        ],
        successMsg: 'Pending items allocated.'
      }
    },

    /**
     * Reject the whole request.
     *
     * Deactivates every item line and reverses any stock that was already
     * allocated with POSITIVE movements, so a partially-allocated request that is
     * later rejected puts its units back on the shelf rather than stranding them.
     */
    reject: (name, { nav }) => {
      const parent = restock()
      if (!text(parent.Code)) return { valid: false, message: 'This restock request could not be loaded.' }
      if (!resourceConfig?.allowed('reject')) return { valid: false, message: 'You are not allowed to reject this restock request.' }
      if (!comment()) return { valid: false, message: 'A comment is required to reject a request.' }

      const rows = (resourceRecord?.childRecordsByResource?.value || {})[CHILD] || []
      const active = rows.map(asRow).filter((row) => text(row.Code) && isActive(row))
      if (active.some((row) => text(row.Progress) === 'DELIVERED')) {
        return { valid: false, message: 'This request has delivered items and can no longer be rejected.' }
      }

      return {
        requests: [
          ...buildRestockRejectBatchRequests(parent, active, actor(), comment()),
          resourceGetRequest(['WarehouseStorages'])
        ],
        successMsg: 'Restock request rejected.',
        onSuccess: () => {
          pageState.reset()
          nav.goTo('view')
        }
      }
    },

    successRoute: 'view'
  }
}
