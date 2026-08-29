import {
  compositeSaveRequest,
  executeActionRequest,
  resourceBulkRequest,
  resourceCreateRequest,
  resourceGetRequest,
  resourceUpdateRequest
} from '../resourceRequests'

// Turns node state into GAS request envelopes. A `strategy.build` override
// replaces `defaultBuild` and must append `additionalActionRequests()` itself.
export function usePageStateBuild ({ state, registry }) {
  // Queued actions are pure domain models in state; the executeAction wire format
  // is put on here, deduped by key so a re-queued action runs once.
  function additionalActionRequests () {
    const seen = new Set()
    const requests = []
    for (const entry of state.actions) {
      if (!entry?.resource || seen.has(entry.key)) continue
      seen.add(entry.key)
      requests.push(executeActionRequest(entry.resource, entry.code, entry.actionConfig, entry.data))
    }
    return requests
  }

  // Every resource a queued action asks to be re-read.
  function actionReloadNames () {
    return state.actions.flatMap((entry) => (Array.isArray(entry?.reload) ? entry.reload : []))
  }

  function defaultHydrate (node, raw) {
    Object.assign(node.record, raw || {})
    if (raw && raw.Code) node.code = raw.Code
  }

  function withPayload (request, node) {
    if (!request || !node.payload || !Object.keys(node.payload).length) return request
    return { ...request, payload: { ...request.payload, ...node.payload } }
  }

  function requestForNode (node) {
    const resource = node.resource
    if (node.many) {
      const records = node.records.map(({ _action, ...data }) => data)
      return records.length ? resourceBulkRequest(resource, records) : null
    }
    if (node.children.length) {
      // Rows are plain data in state; the GAS wire format is put on here.
      const children = node.children.map(c => ({
        resource: c.resource,
        records: c.records.map(({ _action, ...data }) => ({ _action: _action || 'create', data }))
      }))
      const data = { ...node.record }
      return node.code
        ? compositeSaveRequest({ resource, code: node.code, data, children })
        : compositeSaveRequest({ resource, data, children })
    }
    if (node.code) return resourceUpdateRequest(resource, node.code, node.record)
    if (Object.keys(node.record).length) return resourceCreateRequest(resource, node.record)
    return null
  }

  // `state.reload` plus anything this one call adds, deduped and in order.
  function reloadNames (extra = []) {
    const list = [...state.reload, ...actionReloadNames(), ...(Array.isArray(extra) ? extra : [extra])]
    return [...new Set(list.filter(Boolean))]
  }

  function defaultBuild ({ reload } = {}) {
    const requests = []
    registry.eachNode((node) => {
      const request = withPayload(requestForNode(node), node)
      if (request) requests.push(request)
    })
    // Queued actions go after every node, so a `$ref` naming a record this batch
    // creates resolves against a row that already exists.
    requests.push(...additionalActionRequests())
    // The re-read goes last of all, so it sees the finished batch.
    const names = reloadNames(reload)
    if (names.length) requests.push(resourceGetRequest(names, {}))
    return requests
  }

  return { defaultHydrate, defaultBuild, reloadNames, additionalActionRequests }
}
