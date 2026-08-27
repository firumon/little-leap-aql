import { executeActionRequest, textOrRef } from './resourceRequests'

// Node-shaped payload builders — the Layer 2 counterpart of `resourceRequests.js`.
// A domain builder returns these and `pageState.applyNodes()` writes them, so the
// page keeps one assembly path and validation, drafts and snapshots stay honest.

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []))
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

// `payload` carries extra keys merged into the built request beside the record, for the
// few GAS writes that take one.
export function createNode (resource, record = {}, reload = [], payload = null) {
  return { resource, record, reload: list(reload), ...(payload ? { payload } : {}) }
}

// `role` is required whenever a batch updates SEVERAL records of one resource — nodes are
// addressed by resource plus role, so two roleless updates would collapse into one.
export function updateNode (resource, code, record = {}, reload = [], role = '') {
  return { resource, ...(role ? { role } : {}), code: textOrRef(code), record, reload: list(reload) }
}

export function bulkNode (resource, records = [], reload = []) {
  return { resource, many: true, records: Array.isArray(records) ? records : [], reload: list(reload) }
}

export function compositeNode ({ resource, role, code, record = {}, children = [], reload = [] } = {}) {
  return {
    resource,
    ...(role ? { role } : {}),
    ...(code ? { code: textOrRef(code) } : {}),
    record,
    children,
    reload: list(reload)
  }
}

// A derived column: `on` addresses a reactive slice of the tree, `handler(value, pageState)`
// writes the result back. Layer 2 keeps the rule; pageState does the writing.
export function derive (on, handler, options = {}) {
  return { on, handler, ...options }
}

// Carries derivations for a node whose body another payload already supplies.
export function deriveNode (resource, entries = [], role = '') {
  return { resource, ...(role ? { role } : {}), derive: list(entries) }
}

// Re-reads only. It carries no body, so pageState hoists its `reload` and never attaches
// a node — the reserved name keeps it off every real address.
export function reloadNode (resources = []) {
  return { resource: '$batch', reload: list(resources) }
}

// A stamp on a record that already exists. `key` must be unique per TARGET ROW —
// pageState dedupes queued actions by it, and the default `resource::action`
// would collapse a per-row batch into a single stamp.
export function actionNode (resource, code, actionConfig = {}, fields = {}, { key, reload = [] } = {}) {
  const request = executeActionRequest(resource, code, actionConfig, fields)
  const codeKey = typeof code === 'string' ? code : (code?.$ref || '')
  return {
    resource,
    actions: [{
      key: key || `${resource}::${actionConfig.action}::${codeKey}`,
      resource,
      actionName: actionConfig.action,
      request
    }],
    reload: list(reload)
  }
}

// True when a payload carries nothing `build()` would ship — an actions-only or
// reload-only entry. Writing one would attach an empty node that validates but
// never sends.
export function isBodylessNode (payload) {
  if (!isPlainObject(payload)) return true
  if (payload.code !== undefined && payload.code !== null && payload.code !== '') return false
  if (payload.children?.length || payload.records?.length) return false
  return !Object.keys(payload.record || {}).length
}

// Collapses payloads sharing one address so a caller can concatenate envelopes
// freely. Without this, a second payload for the same resource would replace the
// first when written.
export function mergeNodePayloads (payloads = []) {
  const order = []
  const byAddress = new Map()

  for (const payload of payloads) {
    if (!isPlainObject(payload) || !payload.resource) continue
    const address = `${payload.resource}::${payload.role || '$default'}`
    const existing = byAddress.get(address)
    if (!existing) {
      byAddress.set(address, {
        ...payload,
        record: { ...(payload.record || {}) },
        children: (payload.children || []).map((b) => ({ ...b, records: [...(b.records || [])] })),
        records: [...(payload.records || [])],
        reload: [...(payload.reload || [])],
        actions: [...(payload.actions || [])],
        derive: [...(payload.derive || [])],
        payload: { ...(payload.payload || {}) }
      })
      order.push(address)
      continue
    }
    if (payload.code !== undefined) existing.code = payload.code
    if (payload.many !== undefined) existing.many = payload.many
    Object.assign(existing.record, payload.record || {})
    Object.assign(existing.payload, payload.payload || {})
    existing.records.push(...(payload.records || []))
    existing.reload.push(...(payload.reload || []))
    existing.actions.push(...(payload.actions || []))
    existing.derive.push(...(payload.derive || []))
    for (const bucket of payload.children || []) {
      const target = existing.children.find((b) => b.resource === bucket.resource)
      if (target) target.records.push(...(bucket.records || []))
      else existing.children.push({ ...bucket, records: [...(bucket.records || [])] })
    }
  }

  return order.map((address) => {
    const merged = byAddress.get(address)
    merged.reload = [...new Set(merged.reload)]
    if (!merged.records.length && merged.many !== true) delete merged.records
    if (!merged.children.length) delete merged.children
    if (!merged.actions.length) delete merged.actions
    if (!merged.derive.length) delete merged.derive
    if (!Object.keys(merged.payload).length) delete merged.payload
    return merged
  })
}
