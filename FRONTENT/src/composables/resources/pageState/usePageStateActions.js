import { batchRef } from '../resourceRequests'
import { useAdditionalActionsPipeline } from '../additionalActionsPipeline'

// Workflow actions queued INTO this page's own batch, so a record and the action
// stamping it either both land or neither does. The envelope itself is built by
// `additionalActionsPipeline` — no executeAction wire format lives here.
export function usePageStateActions ({ state, registry }) {
  const actionPipeline = useAdditionalActionsPipeline()

  // Omit `options.code` and it resolves to the node's own code when editing, else
  // `batchRef('<Resource>.latest.code')` — so create + act on it is one batch.
  function includeAdditionalAction (actionName, data = {}, options = {}) {
    const { resource, role, code, record, outcome } = options
    const { name, role: r } = registry.resolveTarget(resource || state.primaryKey, role)
    if (!name) {
      console.warn('[usePageState] includeAdditionalAction needs a resource — none resolved for:', actionName)
      return null
    }

    // Read-only lookup: queuing an action must never CREATE a node, or an
    // otherwise-empty page would start building a create request for it.
    const node = registry.peekNode(name, r)

    const resolvedCode = code !== undefined && code !== null && code !== ''
      ? code
      : (node?.code || batchRef(`${name}.latest.code`))

    const request = actionPipeline.buildActionRequest(actionName, {
      resource: name,
      record: record || node?.record || null,
      code: resolvedCode,
      data,
      outcome
    })
    if (!request) return null

    // Keyed by resource + action, so calling twice UPDATES the queued envelope
    // rather than running the action twice.
    const key = `${name}::${actionName}`
    const entry = { key, resource: name, actionName, request }
    const existing = state.pendingActions.findIndex((e) => e.key === key)
    if (existing >= 0) state.pendingActions.splice(existing, 1, entry)
    else state.pendingActions.push(entry)

    return request
  }

  function excludeAdditionalAction (actionName = null, { resource } = {}) {
    if (!actionName) {
      state.pendingActions.splice(0)
      return
    }
    const { name } = registry.resolveTarget(resource || state.primaryKey)
    const index = state.pendingActions.findIndex((e) => e.key === `${name}::${actionName}`)
    if (index >= 0) state.pendingActions.splice(index, 1)
  }

  function additionalActionRequests () {
    return state.pendingActions.map((entry) => entry.request)
  }

  return { includeAdditionalAction, excludeAdditionalAction, additionalActionRequests }
}
