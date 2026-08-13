/**
 * OutletRestocks › Index › ListSwitcher — JS modifier (tier CP: resource + page).
 *
 * The eight list views in `GAS/syncAppResources.gs` serve three different audiences, and
 * showing all eight to everyone makes the switcher a wall of pills where seven are
 * someone else's job. Each pill is gated on the permission for the ACTION that view
 * exists to start:
 *
 *   Drafts            → create        (only a requester has drafts)
 *   PendingApproval   → approve       (an approver's inbox)
 *   NeedsRevision     → create        (the requester revises and resubmits)
 *   PendingCompletion → markDelivered OR reallocate  (the fulfilment work queue)
 *
 * The four remaining views (Approved, PartiallyDelivered, Delivered, Rejected) are
 * read-only states of the same records the user can already see, so they carry no gate
 * beyond the resource's own read permission — that is standard resource view behaviour
 * and is not re-implemented here.
 *
 * `allowed()` resolves `'markDelivered'` to the `canMarkDelivered` flag GAS publishes per
 * AdditionalAction (`GAS/resourceRegistry.gs`), so this list stays in step with the row
 * buttons and the FAB, all three of which read the same flags.
 *
 * Gating the SWITCHER does not gate the DATA — a hidden view is still a filter the record
 * store knows about, and a deep link could still select one. That is fine: every one of
 * these views filters on `Progress` alone, over rows the user is already authorised to
 * read (`RecordAccessPolicy: OWNER_AND_UPLINE`). This is menu hygiene, not access control.
 */

// Which permission each gated view needs. A view absent from this map is ungated.
// `any` = at least one of the listed actions suffices.
const VIEW_GATES = {
  Drafts: { any: ['create'] },
  PendingApproval: { any: ['approve'] },
  NeedsRevision: { any: ['create'] },
  PendingCompletion: { any: ['markDelivered', 'reallocate'] }
}

const RESOURCE = 'OutletRestocks'

export default function (props, { resourceRecord, resourceConfig }) {
  function isVisible (view) {
    const gate = VIEW_GATES[view?.name]
    if (!gate) return true
    return gate.any.some((action) => resourceConfig?.allowed?.({ [RESOURCE]: action }) === true)
  }

  return {
    // Function-valued: a JS modifier resolves once and its result is cached, but
    // `effectiveViews` is populated asynchronously once the resource config and rows
    // land. Only a closure sees the settled list.
    items: () => {
      const views = resourceRecord?.effectiveViews?.value
      if (!Array.isArray(views) || !views.length) return []

      const visible = views.filter(isVisible)
      // Every view gated away (a read-only auditor, say) — fall back to the ungated set
      // rather than rendering an empty switcher with a list still filtered by a view the
      // user cannot see.
      if (!visible.length) return views.filter((view) => !VIEW_GATES[view?.name])

      keepActiveViewVisible(resourceRecord, visible)
      return visible
    }
  }
}

/**
 * Moves the active view onto a visible pill when the default one has been gated away.
 *
 * Without this, a fulfilment user whose `Drafts` pill is hidden still LANDS on Drafts —
 * `default: true` is set in the sheet config, which knows nothing about permissions — and
 * reads an empty list with no pill highlighted, which looks like a data failure.
 *
 * Deferred to a microtask because this runs inside a render-time prop evaluation, and
 * `setActiveView` writes reactive state that the same render is reading. The guard makes
 * it idempotent: once the active view is visible, nothing is scheduled again.
 */
let pendingCorrection = false

function keepActiveViewVisible (resourceRecord, visible) {
  const active = resourceRecord?.activeViewName?.value
  if (!active || visible.some((view) => view.name === active)) {
    pendingCorrection = false
    return
  }
  if (pendingCorrection || typeof resourceRecord?.setActiveView !== 'function') return

  pendingCorrection = true
  queueMicrotask(() => {
    pendingCorrection = false
    // Re-checked on the way in: the user may have clicked a pill in the meantime.
    const current = resourceRecord?.activeViewName?.value
    if (current && !visible.some((view) => view.name === current)) {
      resourceRecord.setActiveView(visible[0].name)
    }
  })
}
