// Shared switcher gating for every Operation resource whose views map to permissions.
// A view absent from the gate map is ungated; `any` means one of the actions suffices.

let pendingCorrection = false

export function keepActiveViewVisible (resourceRecord, visible) {
  const active = resourceRecord?.activeViewName?.value
  if (!active || visible.some((view) => view.name === active)) {
    pendingCorrection = false
    return
  }
  if (pendingCorrection || typeof resourceRecord?.setActiveView !== 'function') return

  pendingCorrection = true
  queueMicrotask(() => {
    pendingCorrection = false
    const current = resourceRecord?.activeViewName?.value
    if (current && !visible.some((view) => view.name === current)) {
      resourceRecord.setActiveView(visible[0].name)
    }
  })
}

export function gatedSwitcherItems (resource, gates, { resourceRecord, resourceConfig }) {
  const views = resourceRecord?.effectiveViews?.value
  if (!Array.isArray(views) || !views.length) return []

  const visible = views.filter((view) => {
    const gate = gates[view?.name]
    if (!gate) return true
    return gate.any.some((action) => resourceConfig?.allowed?.({ [resource]: action }) === true)
  })

  if (!visible.length) return views.filter((view) => !gates[view?.name])

  keepActiveViewVisible(resourceRecord, visible)
  return visible
}

// Builds the whole JS modifier for a gated switcher, so each resource states only its map.
export function listSwitcherModifier (resource, gates) {
  return function (props, ctx) {
    return { items: () => gatedSwitcherItems(resource, gates, ctx) }
  }
}

export function useListSwitcherGating () {
  return { keepActiveViewVisible, gatedSwitcherItems, listSwitcherModifier }
}
