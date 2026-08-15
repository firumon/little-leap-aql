/**
 * OutletConsumptions › Index › ListSwitcher — JS modifier (tier CP: resource + page).
 *
 * The four views serve two audiences, and each pill is gated on the permission for the
 * ACTION that view exists to start (UI_MODULE_DEVELOPER_GUIDE §9.3):
 *
 *   ScheduledOutlets    → create              only someone who can record an audit has a
 *                                             use for a list of outlets to go and audit
 *   InvoiceableOutlets  → create              same actor: the queue exists so they can
 *                                             start a bundled invoice from those outlets
 *
 * `Completed` and `Cancelled` are read-only states of records the user can already see, so
 * they carry no gate beyond the resource's own read permission — that is standard resource
 * view behaviour and is not re-implemented here.
 *
 * Gating the SWITCHER does not gate the DATA. A hidden view is still a filter the record
 * store knows about and a deep link could still select one. That is fine here — every view
 * narrows rows the user is already authorised to read under `OWNER_AND_UPLINE`. This is
 * menu hygiene, not access control.
 *
 * `items` is function-valued: `effectiveViews` is populated asynchronously once the
 * resource config and rows land, and a JS modifier's return is cached at resolve time, so
 * only a closure sees the settled list.
 */

// A view absent from this map is ungated. `any` = one of the listed actions suffices.
const VIEW_GATES = {
  ScheduledOutlets: { any: ['create'] },
  InvoiceableOutlets: { any: ['create'] }
}

const RESOURCE = 'OutletConsumptions'

export default function (props, { resourceRecord, resourceConfig }) {
  function isVisible (view) {
    const gate = VIEW_GATES[view?.name]
    if (!gate) return true
    // Read INSIDE the closure, never outside: the modifier resolves before the auth
    // payload lands, and a permission read taken then latches `false` for the page's life.
    return gate.any.some((action) => resourceConfig?.allowed?.({ [RESOURCE]: action }) === true)
  }

  return {
    items: () => {
      const views = resourceRecord?.effectiveViews?.value
      if (!Array.isArray(views) || !views.length) return []

      const visible = views.filter(isVisible)
      // Every gated view hidden (a read-only auditor) — fall back to the ungated set
      // rather than rendering an empty switcher over a list still filtered by a view the
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
 * Without this, a user whose `ScheduledOutlets` pill is hidden still LANDS on it —
 * `default: true` lives in the sheet config, which knows nothing about permissions — and
 * reads an empty list with no pill highlighted, which looks like a data failure.
 *
 * Deferred to a microtask because this runs inside a render-time prop evaluation and
 * `setActiveView` writes reactive state the same render is reading. The guard makes it
 * idempotent: once the active view is visible, nothing is scheduled again.
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
