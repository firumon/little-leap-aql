import {
  compositeSaveRequest,
  resourceBulkRequest,
  resourceCreateRequest,
  resourceUpdateRequest
} from '../resourceRequests'

// Turns node state into GAS request envelopes. A `strategy.build` override
// replaces `defaultBuild` and must append `additionalActionRequests()` itself.
export function usePageStateBuild ({ registry, additionalActionRequests }) {
  function defaultHydrate (node, raw) {
    Object.assign(node.record, raw || {})
    if (raw && raw.Code) node.code = raw.Code
  }

  function requestForNode (node) {
    const resource = node.resource
    if (node.many) {
      const records = node.records.map(r => r.data)
      return records.length ? resourceBulkRequest(resource, records) : null
    }
    if (node.children.length) {
      const children = node.children.map(c => ({
        resource: c.resource,
        records: c.records.map(r => ({ _action: r._action || 'create', data: r.data }))
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

  function defaultBuild () {
    const requests = []
    registry.eachNode((node) => {
      const request = requestForNode(node)
      if (request) requests.push(request)
    })
    // Queued actions go LAST so a `$ref` naming a record this batch creates
    // resolves against a row that already exists.
    requests.push(...additionalActionRequests())
    return requests
  }

  return { defaultHydrate, defaultBuild }
}
