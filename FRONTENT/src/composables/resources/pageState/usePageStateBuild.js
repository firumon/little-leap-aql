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

  // `_`-prefixed keys are frontend-only. `_action` is the oldest of them; a live node
  // also carries the tags that link a derived row back to the input it came from, and
  // neither is a sheet column.
  const wireData = (row) => {
    const data = {}
    for (const key in row) { if (key.charAt(0) !== '_') data[key] = row[key] }
    return data
  }

  function requestForNode (node) {
    const resource = node.resource
    if (node.many) {
      const records = node.records.map(wireData)
      return records.length ? resourceBulkRequest(resource, records) : null
    }
    if (node.children.length) {
      // Rows are plain data in state; the GAS wire format is put on here.
      const children = node.children.map(c => ({
        resource: c.resource,
        records: c.records.map((row) => ({ _action: row._action || 'create', data: wireData(row) }))
      }))
      const data = wireData(node.record)
      return node.code
        ? compositeSaveRequest({ resource, code: node.code, data, children })
        : compositeSaveRequest({ resource, data, children })
    }
    // An empty record writes nothing. A page keeps a coded node around as an ADDRESS —
    // for `hasNodes`, for its controls, for hydration bookkeeping — and that node must
    // not turn into an update with no columns in it.
    const data = wireData(node.record)
    if (!Object.keys(data).length) return null
    return node.code
      ? resourceUpdateRequest(resource, node.code, data)
      : resourceCreateRequest(resource, data)
  }

  // Every resource this batch already writes: the nodes that ship a request, the child
  // buckets inside them, and the resource of every queued action. GAS returns a written
  // row in the same response, so asking for it back is a wasted round trip.
  function writtenResources () {
    const names = new Set()
    registry.eachNode((node) => {
      if (!requestForNode(node)) return
      names.add(node.resource)
      for (const bucket of node.children || []) {
        if (bucket.resource && bucket.records?.length) names.add(bucket.resource)
      }
    })
    for (const entry of state.actions) {
      if (entry?.resource) names.add(entry.resource)
    }
    return names
  }

  // `state.reload` plus anything this one call adds, deduped, in order, and minus
  // everything the batch writes for itself.
  function reloadNames (extra = []) {
    const list = [...state.reload, ...actionReloadNames(), ...(Array.isArray(extra) ? extra : [extra])]
    const written = writtenResources()
    return [...new Set(list.filter(Boolean))].filter((name) => !written.has(name))
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
